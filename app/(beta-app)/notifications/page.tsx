import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { getMyNotifications } from '@/lib/notifications/get'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { getAllMyPendingOffers } from '../troop/listing-lifecycle-actions'
import { NotificationList } from './notification-list'
import type { ConversationRequestSummary, OfferSummary } from '@/components/messages/request-offer-cards'

async function NotificationsContent() {
    const { db, user } = await requireMember()

    const [notificationsResult, offersResult, { data: pendingConversationRows }] = await Promise.all([
        getMyNotifications(),
        getAllMyPendingOffers(),
        db
            .from('conversations')
            .select('id, initiated_by, updated_at, participant_one_id, participant_two_id')
            .eq('status', 'pending')
            .neq('initiated_by', user.id)
            .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`),
    ])

    if (!notificationsResult.success) {
        return <p className="text-sm text-red-600">{notificationsResult.error}</p>
    }

    const otherUserIds = (pendingConversationRows ?? []).map((c) =>
        c.participant_one_id === user.id ? c.participant_two_id : c.participant_one_id,
    )
    const conversationIds = (pendingConversationRows ?? []).map((c) => c.id)

    const [{ data: otherProfiles }, { data: recentMessages }] = await Promise.all([
        otherUserIds.length > 0
            ? db.from('users').select('id, username, responses').in('id', otherUserIds)
            : Promise.resolve({ data: [] }),
        conversationIds.length > 0
            ? db
                .from('messages')
                .select('conversation_id, content, image_path, created_at')
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
    ])

    const avatarPaths = (otherProfiles ?? []).map((p) => p.responses?.profile_picture_path)
    const avatarUrlByPath = await signProfilePictureUrls(db, avatarPaths)

    const requests: ConversationRequestSummary[] = (pendingConversationRows ?? []).map((conversation) => {
        const otherUserId = conversation.participant_one_id === user.id
            ? conversation.participant_two_id
            : conversation.participant_one_id
        const profile = otherProfiles?.find((p) => p.id === otherUserId)
        const avatarPath = profile?.responses?.profile_picture_path
        const lastMessage = recentMessages?.find((m) => m.conversation_id === conversation.id)

        return {
            id: conversation.id,
            otherUser: {
                username: profile?.username ?? 'Unknown',
                profilePictureUrl: (avatarPath && avatarUrlByPath.get(avatarPath)) ?? null,
            },
            lastMessagePreview: lastMessage
                ? (lastMessage.content ?? (lastMessage.image_path ? 'Sent a photo' : null))
                : null,
            updatedAt: conversation.updated_at,
        }
    })

    const offers: OfferSummary[] = offersResult.success ? offersResult.offers : []

    return (
        <NotificationList
            notifications={notificationsResult.notifications}
            requests={requests}
            offers={offers}
        />
    )
}

export default function NotificationsPage() {
    return (
        <main className="relative flex flex-1 flex-col items-center px-8 pb-40 pt-12">
            <Suspense fallback={null}>
                <NotificationsContent />
            </Suspense>
        </main>
    )
}
