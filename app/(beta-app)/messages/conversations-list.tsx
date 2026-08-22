'use client'

import { useState, useTransition } from 'react'
import { acceptListingOffer, declineListingOffer } from '../troop/listing-lifecycle-actions'
import { acceptConversationRequest, declineConversationRequest } from './actions'
import { NotificationCard } from '@/components/messages/notification-card'
import { ChatCard } from '@/components/messages/chat-card'
import type { ListingTransactionType } from '@/lib/listings/domain'

type ConversationSummary = {
    id: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    originType: string
    transactionType: ListingTransactionType | null
    title: string | null
    otherUser: {
        id: string
        username: string
        profilePictureUrl: string | null
        lastActiveAt: string | null
    }
    lastMessagePreview: string | null
    lastMessageAt: string | null
    updatedAt: string
}

type OfferSummary = {
    offerId: string
    createdAt: string
    targetListing: { id: string; title: string }
    offerer: { id: string; username: string; profilePictureUrl: string | null }
    offeredListing: { id: string; title: string; coverPhotoUrl: string | null }
}

function emptyRequestPreview(conversation: ConversationSummary) {
    if (conversation.originType !== 'listing' || !conversation.transactionType) {
        return 'Say hello!'
    }

    const listingLabel = conversation.title ? `"${conversation.title}"` : 'this listing'
    switch (conversation.transactionType) {
        case 'sell':
            return `Buy request for ${listingLabel} (no message included).`
        case 'gift':
            return `Gift request for ${listingLabel} (no message included).`
        case 'lend':
            return `Borrow request for ${listingLabel} (no message included).`
        case 'trade':
            return `Trade request for ${listingLabel} (no message included).`
    }
}

function RequestCard({
    conversation,
    onResolved,
}: {
    conversation: ConversationSummary
    onResolved: (conversationId: string) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleChat() {
        setError(null)
        startTransition(async () => {
            const result = await acceptConversationRequest(conversation.id)
            if (!result.success) {
                setError(result.error ?? 'Could not accept this request.')
                return
            }
            onResolved(conversation.id)
            window.location.href = `/messages/${conversation.id}`
        })
    }

    function handleDecline() {
        setError(null)
        startTransition(async () => {
            const result = await declineConversationRequest(conversation.id)
            if (!result.success) {
                setError(result.error ?? 'Could not decline this request.')
                return
            }
            onResolved(conversation.id)
        })
    }

    return (
        <NotificationCard
            username={conversation.otherUser.username}
            profilePictureUrl={conversation.otherUser.profilePictureUrl}
            reason={conversation.lastMessagePreview ?? emptyRequestPreview(conversation)}
            timestamp={conversation.updatedAt}
            isPending={isPending}
            error={error}
            onChat={handleChat}
            onDecline={handleDecline}
        />
    )
}

function OfferCard({
    offer,
    onResolved,
}: {
    offer: OfferSummary
    onResolved: (offerId: string) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleChat() {
        setError(null)
        startTransition(async () => {
            const result = await acceptListingOffer(offer.offerId)
            if (!result.success) {
                setError(result.error ?? 'Could not accept this offer.')
                return
            }
            onResolved(offer.offerId)
            if (result.conversationId) {
                window.location.href = `/messages/${result.conversationId}`
            }
        })
    }

    function handleDecline() {
        setError(null)
        startTransition(async () => {
            const result = await declineListingOffer(offer.offerId)
            if (!result.success) {
                setError(result.error ?? 'Could not decline this offer.')
                return
            }
            onResolved(offer.offerId)
        })
    }

    return (
        <NotificationCard
            username={offer.offerer.username}
            profilePictureUrl={offer.offerer.profilePictureUrl}
            reason={
                <>
                    Offered <span className="font-medium text-foreground">{offer.offeredListing.title}</span> for your{' '}
                    <span className="font-medium text-foreground">{offer.targetListing.title}</span>
                </>
            }
            timestamp={offer.createdAt}
            isPending={isPending}
            error={error}
            onChat={handleChat}
            onDecline={handleDecline}
        />
    )
}

type NotificationItem =
    | { kind: 'request'; timestamp: string; conversation: ConversationSummary }
    | { kind: 'offer'; timestamp: string; offer: OfferSummary }

export function ConversationsList({
    conversations: initialConversations,
    offers: initialOffers,
}: {
    conversations: ConversationSummary[]
    offers: OfferSummary[]
}) {
    const [conversations, setConversations] = useState(initialConversations)
    const [offers, setOffers] = useState(initialOffers)
    const [tab, setTab] = useState<'notifications' | 'messages'>('notifications')

    const needsMyResponse = conversations.filter((c) => c.status === 'pending' && !c.initiatedByMe)
    const messages = conversations.filter((c) => c.status === 'active' || c.initiatedByMe)

    const notifications: NotificationItem[] = [
        ...needsMyResponse.map((conversation): NotificationItem => ({
            kind: 'request',
            timestamp: conversation.updatedAt,
            conversation,
        })),
        ...offers.map((offer): NotificationItem => ({
            kind: 'offer',
            timestamp: offer.createdAt,
            offer,
        })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    function handleOfferResolved(offerId: string) {
        setOffers((current) => current.filter((offer) => offer.offerId !== offerId))
    }

    function handleRequestResolved(conversationId: string) {
        setConversations((current) => current.filter((c) => c.id !== conversationId))
    }

    return (
        <div className="w-full max-w-md">
            <h1 className="mb-6 text-3xl font-semibold text-foreground">Messages</h1>

            <div className="mb-4 flex rounded-full border border-border bg-card p-1">
                <button
                    onClick={() => setTab('notifications')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                        tab === 'notifications' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                >
                    Notifications
                    {notifications.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">
                            {notifications.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('messages')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                        tab === 'messages' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                >
                    Messages
                </button>
            </div>

            {tab === 'notifications' && (
                notifications.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                        <p className="text-sm text-muted-foreground">No notifications right now.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {notifications.map((item) =>
                            item.kind === 'request' ? (
                                <RequestCard
                                    key={item.conversation.id}
                                    conversation={item.conversation}
                                    onResolved={handleRequestResolved}
                                />
                            ) : (
                                <OfferCard key={item.offer.offerId} offer={item.offer} onResolved={handleOfferResolved} />
                            )
                        )}
                    </div>
                )
            )}

            {tab === 'messages' && (
                messages.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                        <p className="text-sm text-muted-foreground">No conversations yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((c) => (
                            <ChatCard
                                key={c.id}
                                href={`/messages/${c.id}`}
                                username={c.otherUser.username}
                                profilePictureUrl={c.otherUser.profilePictureUrl}
                                lastActiveAt={c.otherUser.lastActiveAt}
                                isActive={c.status === 'active'}
                                isPending={c.status === 'pending' && c.initiatedByMe}
                                originType={c.originType}
                                transactionType={c.transactionType}
                                title={c.title}
                                lastMessagePreview={c.lastMessagePreview}
                                lastMessageAt={c.lastMessageAt}
                            />
                        ))}
                    </div>
                )
            )}
        </div>
    )
}
