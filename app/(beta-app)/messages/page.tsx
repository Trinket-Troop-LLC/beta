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

    // 'listing' and 'offer' conversations link back to a listing via
    // origin_id; 'message_board' conversations link back to a bulletin post
    // the same way. Batch-fetch both so each card can show what it's about.
    const listingOriginIds = conversations
        ?.filter((c) => (c.origin_type === 'listing' || c.origin_type === 'offer') && c.origin_id)
        .map((c) => c.origin_id as string) ?? []
    const bulletinOriginIds = conversations
        ?.filter((c) => c.origin_type === 'message_board' && c.origin_id)
        .map((c) => c.origin_id as string) ?? []

    const { data: originListings } = listingOriginIds.length > 0
        ? await db.from('listings').select('id, title').in('id', listingOriginIds)
        : { data: [] }
    const { data: originBulletinPosts } = bulletinOriginIds.length > 0
        ? await db.from('bulletin_posts').select('id, content').in('id', bulletinOriginIds)
        : { data: [] }

    function titleFor(conversation: { origin_type: string; origin_id: string | null }): string | null {
        if (conversation.origin_type === 'listing' || conversation.origin_type === 'offer') {
            return originListings?.find((l) => l.id === conversation.origin_id)?.title ?? null
        }
        if (conversation.origin_type === 'message_board') {
            const content = originBulletinPosts?.find((p) => p.id === conversation.origin_id)?.content
            if (!content) return null
            return content.length > 60 ? `${content.slice(0, 60)}…` : content
        }
        return null
    }

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
            originType: conversation.origin_type,
            title: titleFor(conversation),
            otherUser: {
                id: otherUserId,
                username: profile?.username ?? 'Unknown',
                profilePictureUrl: (path && signedUrlsByPath.get(path)) ?? null,
                lastActiveAt: profile?.last_active_at ?? null,
            },
            lastMessagePreview: lastMessage
                ? (lastMessage.content ?? (lastMessage.image_path ? 'Sent a photo' : ''))
                : null,
            lastMessageAt: lastMessage?.created_at ?? null,
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