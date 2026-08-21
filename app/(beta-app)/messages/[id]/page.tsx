import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import { ChatView } from './chat-view'
import { TradeClosedNotice } from '../trade-closed-notice'

async function ConversationContent({ conversationId }: { conversationId: string }) {
    const { db, user } = await requireMember()

    const { data: conversation } = await db
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle()

    if (!conversation) {
        notFound()
    }

    const isParticipant = conversation.participant_one_id === user.id || conversation.participant_two_id === user.id
    if (!isParticipant) {
        notFound()
    }

    if (conversation.status === 'completed' || conversation.status === 'closed') {
        return <TradeClosedNotice status={conversation.status} />
    }

    const otherUserId = conversation.participant_one_id === user.id
        ? conversation.participant_two_id
        : conversation.participant_one_id

    const { data: otherProfile } = await db
        .from('users')
        .select('id, username, responses')
        .eq('id', otherUserId)
        .single()

    const otherUserPictureUrl = await signProfilePictureUrl(db, otherProfile?.responses?.profile_picture_path)

    const { data: messages } = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    const listingTitle = conversation.origin_type === 'offer' && conversation.listing_id
        ? (
            await db
                .from('listings')
                .select('title')
                .eq('id', conversation.listing_id)
                .maybeSingle()
        ).data?.title ?? null
        : null

    return (
        <ChatView
            conversationId={conversation.id}
            status={conversation.status}
            initiatedByMe={conversation.initiated_by === user.id}
            currentUserId={user.id}
            otherUser={{
                id: otherUserId,
                username: otherProfile?.username ?? 'Unknown',
                profilePictureUrl: otherUserPictureUrl,
            }}
            initialMessages={messages ?? []}
            originType={conversation.origin_type}
            listingId={conversation.listing_id}
            listingTitle={listingTitle}
        />
    )
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    return (
        <main className="relative flex min-h-screen flex-col bg-[#faf7f0] pb-28">
            <Suspense fallback={null}>
                <ConversationContent conversationId={id} />
            </Suspense>
        </main>
    )
}