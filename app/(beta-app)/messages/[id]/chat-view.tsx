'use client'

import { useRef, useState } from 'react'
import { sendMessage } from '../actions'
import { useConversationRealtime } from './use-conversation-realtime'
import { useListingLifecycle } from './use-listing-lifecycle'
import { ConversationActionBar } from './conversation-action-bar'
import { ConversationHeader } from './conversation-header'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import type { Message, OtherUser } from './types'

// Which side of the exchange the current user is on, in their own words --
// the owner is always the one giving the item away, whether that's for
// money (sell), free (gift), or on loan (lend).
const EXCHANGE_VERBS: Record<string, { owner: string; other: string }> = {
    sell: { owner: 'Selling', other: 'Buying' },
    gift: { owner: 'Gifting', other: 'Receiving' },
    lend: { owner: 'Lending', other: 'Borrowing' },
}

export function ChatView({
    conversationId,
    status,
    initiatedByMe,
    currentUserId,
    otherUser,
    initialMessages,
    listing,
    tradeItems,
    requestedTransactionType,
    closedReason,
    originType,
}: {
    conversationId: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    currentUserId: string
    otherUser: OtherUser
    initialMessages: Message[]
    listing: {
        id: string
        title: string
        status: string
        activeTransactionType: string | null
        isOwner: boolean
    } | null
    tradeItems: { itemA: { title: string }; itemB: { title: string } } | null
    requestedTransactionType: string | null
    closedReason: 'fulfilled' | 'cancelled' | 'closed' | null
    originType: string
}) {
    const [messages, setMessages] = useState(initialMessages)
    const [draft, setDraft] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [listingStatus, setListingStatus] = useState(listing?.status ?? null)
    // handleMarkFulfilled/handleMarkReturned/handleUnreserve/handleEndConversation
    // already redirect the clicking user straight off their server action's
    // return value -- this ref, shared with the realtime subscription, stops
    // its listener from redirecting them a second time (possibly away from
    // wherever they've since navigated to) when the echo of their own update
    // comes back over the subscription.
    const hasHandledClosureRef = useRef(false)

    // Listing-linked threads already have their own domain-specific ways to
    // close (mark complete / didn't work out / unreserve) -- a plain "end
    // conversation" control is only for threads with no transaction attached
    // to them, so it can't be used to dodge that flow.
    const canEndConversation = originType === 'message_board' || originType === 'direct'
    const isLend = listing?.activeTransactionType === 'lend'

    const { dealFulfilled } = useConversationRealtime({
        conversationId,
        currentUserId,
        listing,
        initialDealFulfilled: closedReason === 'fulfilled',
        setMessages,
        setListingStatus,
        hasHandledClosureRef,
    })

    const {
        isUpdatingListing,
        listingActionError,
        showReturnChoice,
        setShowReturnChoice,
        isEnding,
        showEndConfirm,
        setShowEndConfirm,
        endError,
        handleMarkFulfilled,
        handleUnreserve,
        handleMarkReturned,
        handleEndConversation,
    } = useListingLifecycle({ conversationId, listing, setListingStatus, hasHandledClosureRef })

    async function handleSend() {
        const trimmed = draft.trim()
        if (!trimmed || isSending) return

        setIsSending(true)
        const result = await sendMessage(conversationId, trimmed)

        if (result.success) {
            // Add it locally with its real id so the realtime echo of our own
            // insert (now that the subscription auth race is fixed) dedupes
            // against this instead of rendering a second copy.
            setMessages((prev) => {
                if (prev.some((m) => m.id === result.message.id)) return prev
                return [...prev, result.message]
            })
            setDraft('')
        }
        setIsSending(false)
    }

    const isPendingForMe = status === 'pending' && !initiatedByMe
    const exchangeType = listing?.activeTransactionType ?? requestedTransactionType
    const exchangeVerb = exchangeType ? EXCHANGE_VERBS[exchangeType]?.[listing?.isOwner ? 'owner' : 'other'] : null

    return (
        <div className="flex min-h-screen flex-col">
            <ConversationActionBar
                status={status}
                listingStatus={listingStatus}
                isLend={isLend}
                isListingOwner={listing?.isOwner ?? false}
                isUpdatingListing={isUpdatingListing}
                showReturnChoice={showReturnChoice}
                setShowReturnChoice={setShowReturnChoice}
                onMarkFulfilled={handleMarkFulfilled}
                onUnreserve={handleUnreserve}
                onMarkReturned={handleMarkReturned}
                canEndConversation={canEndConversation}
                isEnding={isEnding}
                showEndConfirm={showEndConfirm}
                setShowEndConfirm={setShowEndConfirm}
                onEndConversation={handleEndConversation}
            />
            {(endError || listingActionError) && (
                <p role="alert" className="border-b border-border/70 bg-background/90 px-8 py-2 text-sm text-red-600">
                    {endError ?? listingActionError}
                </p>
            )}

            {listing && (
                <p className="mx-8 mt-3 truncate text-center text-sm font-semibold text-foreground">
                    {exchangeVerb ? `${exchangeVerb}: ${listing.title}` : listing.title}
                </p>
            )}

            {tradeItems && (
                <p className="mx-8 mt-3 truncate text-center text-sm font-semibold text-foreground">
                    Trading: {tradeItems.itemA.title} and {tradeItems.itemB.title}
                </p>
            )}

            <ConversationHeader otherUser={otherUser} />

            <MessageList
                messages={messages}
                currentUserId={currentUserId}
                status={status}
                isPendingForMe={isPendingForMe}
                otherUsername={otherUser.username}
                listingStatus={listingStatus}
                isListingOwner={listing?.isOwner ?? false}
                dealFulfilled={dealFulfilled}
            />

            {status === 'active' && (
                <MessageComposer draft={draft} setDraft={setDraft} isSending={isSending} onSend={handleSend} />
            )}
        </div>
    )
}
