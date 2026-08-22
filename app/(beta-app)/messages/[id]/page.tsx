import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import { createAdminClient } from '@/lib/supabase/admin'
import { findPairedTradeListingId } from '@/app/(beta-app)/troop/listing-lifecycle-actions'
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
        .select('id, username, responses, last_active_at')
        .eq('id', otherUserId)
        .single()

    const otherUserPictureUrl = await signProfilePictureUrl(db, otherProfile?.responses?.profile_picture_path)

    const { data: messages } = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    // 'listing' and 'offer' conversations link back to a listing via
    // origin_id. Only surface the reservation controls (Mark complete /
    // Didn't work out, or the lend-specific relist/remove choice) to that
    // listing's owner (isOwner) -- except for a trade ('offer'), which
    // reserves two listings as one transaction (see acceptListingOffer).
    // There, the other participant owns the *paired* listing, not origin_id,
    // so look that up too or they'd never see the controls to mark their
    // side complete. Everyone else in the conversation (a buyer in a plain
    // sell/gift, or a borrower in a lend) still gets the listing back with
    // isOwner: false, so ChatView can show them the live status/redirect
    // without exposing owner-only controls.
    let listing: {
        id: string
        title: string
        status: string
        activeTransactionType: string | null
        isOwner: boolean
    } | null = null
    // For a trade ('offer'), the context card needs both sides of the deal
    // regardless of which one the current user owns -- "Trading: X and Y" --
    // unlike `listing` above, which only ever tracks the one they own (for
    // the owner-only Mark complete / Didn't work out controls).
    let tradeItems: { itemA: { title: string }; itemB: { title: string } } | null = null

    if ((conversation.origin_type === 'listing' || conversation.origin_type === 'offer') && conversation.origin_id) {
        const { data: linkedListing } = await db
            .from('listings')
            .select('id, owner_id, title, status, active_transaction_type')
            .eq('id', conversation.origin_id)
            .maybeSingle()

        if (linkedListing) {
            let pairedListing: { id: string; owner_id: string; title: string; status: string; active_transaction_type: string | null } | null = null

            if (conversation.origin_type === 'offer') {
                const admin = createAdminClient()
                const pairedListingId = await findPairedTradeListingId(admin, linkedListing.id)
                if (pairedListingId) {
                    const { data } = await db
                        .from('listings')
                        .select('id, owner_id, title, status, active_transaction_type')
                        .eq('id', pairedListingId)
                        .maybeSingle()
                    pairedListing = data
                }

                tradeItems = {
                    itemA: { title: linkedListing.title },
                    itemB: { title: pairedListing?.title ?? 'their item' },
                }
            }

            const owned = linkedListing.owner_id === user.id
                ? linkedListing
                : pairedListing?.owner_id === user.id
                    ? pairedListing
                    : null

            if (owned) {
                listing = {
                    id: owned.id,
                    title: owned.title,
                    status: owned.status,
                    activeTransactionType: owned.active_transaction_type,
                    isOwner: true,
                }
            } else {
                listing = {
                    id: linkedListing.id,
                    title: linkedListing.title,
                    status: linkedListing.status,
                    activeTransactionType: linkedListing.active_transaction_type,
                    isOwner: false,
                }
            }
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
                lastActiveAt: otherProfile?.last_active_at ?? null,
            }}
            initialMessages={messages ?? []}
            listing={listing}
            tradeItems={tradeItems}
            requestedTransactionType={conversation.transaction_type ?? null}
            closedReason={conversation.closed_reason ?? null}
            originType={conversation.origin_type}
        />
    )
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    return (
        <main className="relative flex flex-1 flex-col pb-40">
            <Suspense fallback={null}>
                <ConversationContent conversationId={id} />
            </Suspense>
        </main>
    )
}