import "server-only";
import { createAdminClient } from '@/lib/supabase/admin'

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

// Notifications are best-effort: a failure here is logged but never thrown,
// so it can't break the actual action (friend request, offer, etc.) that
// triggered it.
//
// This is also the single call site where a future push notification would
// be sent alongside the in-app row, once that infrastructure exists — see
// the commented call below.
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

    // await sendPushNotification(input)
}