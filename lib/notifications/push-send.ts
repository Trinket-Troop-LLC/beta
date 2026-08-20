import "server-only";
import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export type PushPayload = {
    title: string;
    body: string;
    url: string;
};

// Best-effort, same as createNotification: a push failure never throws back
// into the action (friend request, offer, etc.) that triggered it.
export async function sendPushNotification(recipientId: string, payload: PushPayload) {
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
        // VAPID keys aren't configured in this environment (e.g. local dev
        // without .env.local set up) -- skip silently rather than erroring.
        return;
    }

    const admin = createAdminClient();
    const { data: subscriptions, error } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", recipientId);

    if (error || !subscriptions || subscriptions.length === 0) return;

    const staleSubscriptionIds: string[] = [];

    await Promise.all(
        subscriptions.map(async (subscription) => {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    },
                    JSON.stringify(payload),
                );
            } catch (err) {
                const statusCode = (err as { statusCode?: number })?.statusCode;
                // 404/410 mean the browser has unregistered this subscription
                // (uninstalled, permission revoked, etc.) -- it will never
                // succeed again, so stop trying to send to it.
                if (statusCode === 404 || statusCode === 410) {
                    staleSubscriptionIds.push(subscription.id);
                } else {
                    console.error("Could not send push notification", { recipientId, error: err });
                }
            }
        }),
    );

    if (staleSubscriptionIds.length > 0) {
        await admin.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
    }
}
