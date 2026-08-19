import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { ChatView } from './chat-view'

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

    // 'listing' and 'offer' conversations link back to a listing via
    // origin_id. The reservation controls (Mark complete / Didn't work out,
    // or the lend-specific relist/remove choice) are still owner-only, but
    // both participants need to see the listing's current status live --
    // otherwise the non-owner has no way to know the owner acted until they
    // refresh (see chat-view.tsx's listings realtime subscription).
    let linkedListing: { id: string; status: string; activeTransactionType: string | null } | null = null
    let isOwnedByMe = false
    if ((conversation.origin_type === 'listing' || conversation.origin_type === 'offer') && conversation.origin_id) {
        const { data: listingRow } = await db
            .from('listings')
            .select('id, owner_id, status, active_transaction_type')
            .eq('id', conversation.origin_id)
            .maybeSingle()

        if (listingRow) {
            linkedListing = {
                id: listingRow.id,
                status: listingRow.status,
                activeTransactionType: listingRow.active_transaction_type,
            }
            isOwnedByMe = listingRow.owner_id === user.id
        }
    }

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
            linkedListing={linkedListing}
            isOwnedByMe={isOwnedByMe}
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
            <BetaBottomNav />
        </main>
    )
}