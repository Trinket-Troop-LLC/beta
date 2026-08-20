import "server-only";
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification, type PushPayload } from '@/lib/notifications/push-send'

export type NotificationType =
    | 'listing_interest'
    | 'friend_request'
    | 'friend_request_accepted'
    | 'bulletin_reply'
    | 'exchange_cancelled'
    | 'exchange_complete_review_prompt'

type NotificationInput = {
    recipientId: string
    type: NotificationType
    actorId?: string
    relatedListingId?: string
    relatedConversationId?: string
    relatedBulletinPostId?: string
}

async function buildPushPayload(
    admin: ReturnType<typeof createAdminClient>,
    input: NotificationInput,
): Promise<PushPayload> {
    let actorUsername: string | null = null
    if (input.actorId) {
        const { data } = await admin.from('users').select('username').eq('id', input.actorId).maybeSingle()
        actorUsername = data?.username ?? null
    }
    const who = actorUsername ? `@${actorUsername}` : 'Someone'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

    switch (input.type) {
        case 'listing_interest':
            return {
                title: 'New interest in your listing',
                body: `${who} is interested in one of your listings.`,
                url: `${siteUrl}${input.relatedListingId ? `/troop/listings/${input.relatedListingId}` : '/troop'}`,
            }
        case 'friend_request':
            return {
                title: 'New friend request',
                body: `${who} sent you a friend request.`,
                url: `${siteUrl}/profile`,
            }
        case 'friend_request_accepted':
            return {
                title: 'Friend request accepted',
                body: `${who} accepted your friend request.`,
                url: `${siteUrl}/profile`,
            }
        case 'bulletin_reply':
            return {
                title: 'New reply',
                body: `${who} replied to your post.`,
                url: `${siteUrl}/thoughts`,
            }
        case 'exchange_cancelled':
            return {
                title: 'Exchange cancelled',
                body: `${who} cancelled an exchange.`,
                url: `${siteUrl}/troop`,
            }
        case 'exchange_complete_review_prompt':
            return {
                title: 'Exchange complete',
                body: `${who} marked your exchange as complete. Leave a review?`,
                url: `${siteUrl}${input.relatedConversationId ? `/review/${input.relatedConversationId}` : '/troop'}`,
            }
    }
}

// Notifications are best-effort: a failure here is logged but never thrown,
// so it can't break the actual action (friend request, offer, etc.) that
// triggered it. Same for the push send that follows -- see
// lib/notifications/push-send.ts.
export async function createNotification(input: NotificationInput) {
    const admin = createAdminClient()
    const { error } = await admin.from('notifications').insert({
        recipient_id: input.recipientId,
        type: input.type,
        actor_id: input.actorId ?? null,
        related_listing_id: input.relatedListingId ?? null,
        related_conversation_id: input.relatedConversationId ?? null,
        related_bulletin_post_id: input.relatedBulletinPostId ?? null,
    })

    if (error) {
        console.error('Could not create notification', { input, error })
        return
    }

    const payload = await buildPushPayload(admin, input)
    await sendPushNotification(input.recipientId, payload)
}