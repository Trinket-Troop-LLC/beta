import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { BetaAppChrome } from '@/components/beta-app-chrome'
import { ConversationsList } from './conversations-list'
import { getAllMyPendingOffers } from '../troop/listing-lifecycle-actions'

async function MessagesContent() {
    const { db, user } = await requireMember()

    const { data: conversations } = await db
        .from('conversations')
        .select('*')
        .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
        .neq('status', 'closed')
        .order('updated_at', { ascending: false })

    const otherUserIds = conversations?.map((c) =>
        c.participant_one_id === user.id ? c.participant_two_id : c.participant_one_id
    ) ?? []

    const { data: profiles } = await db
        .from('users')
        .select('id, username, responses, last_active_at')
        .in('id', otherUserIds)

    const paths = profiles?.map((p) => p.responses?.profile_picture_path) ?? []
    const signedUrlsByPath = await signProfilePictureUrls(db, paths)

    const conversationIds = conversations?.map((c) => c.id) ?? []
    const { data: recentMessages } = conversationIds.length > 0
        ? await db
            .from('messages')
            .select('conversation_id, content, image_path, created_at, sender_id')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
        : { data: [] }

    const conversationsWithDetails = conversations?.map((conversation) => {
        const otherUserId = conversation.participant_one_id === user.id
            ? conversation.participant_two_id
            : conversation.participant_one_id

        const profile = profiles?.find((p) => p.id === otherUserId)
        const path = profile?.responses?.profile_picture_path

        const lastMessage = recentMessages?.find((m) => m.conversation_id === conversation.id)

        return {
            id: conversation.id,
            status: conversation.status,
            initiatedByMe: conversation.initiated_by === user.id,
            otherUser: {
                id: otherUserId,
                username: profile?.username ?? 'Unknown',
                profilePictureUrl: (path && signedUrlsByPath.get(path)) ?? null,
                lastActiveAt: profile?.last_active_at ?? null,
            },
            lastMessagePreview: lastMessage
                ? (lastMessage.content ?? (lastMessage.image_path ? 'Sent a photo' : ''))
                : null,
            updatedAt: conversation.updated_at,
        }
    }) ?? []

    const pendingOffersResult = await getAllMyPendingOffers()
    const offers = pendingOffersResult.success ? pendingOffersResult.offers : []

    return <ConversationsList conversations={conversationsWithDetails} offers={offers} />
}

export default function MessagesPage() {
    return (
        <main className="relative flex min-h-screen flex-col items-center bg-[#faf7f0] pb-28 pt-12">
            <Suspense fallback={null}>
                <MessagesContent />
            </Suspense>
            <BetaAppChrome />
        </main>
    )
}