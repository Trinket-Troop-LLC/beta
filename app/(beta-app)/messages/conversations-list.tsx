'use client'

import { useRef, useState, useTransition } from 'react'
import { acceptListingOffer, declineListingOffer } from '../troop/listing-lifecycle-actions'
import { acceptConversationRequest, declineConversationRequest } from './actions'
import { NotificationCard } from '@/components/messages/notification-card'
import { ChatCard } from '@/components/messages/chat-card'
import {
    SentOfferCard,
    type OfferableListing,
    type SentOfferSummary,
} from '@/components/messages/sent-offer-card'

type ConversationSummary = {
    id: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    originType: string
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
            reason={conversation.lastMessagePreview ?? 'Say hello!'}
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
                    Offered <span className="font-medium text-[#2c2c2c]">{offer.offeredListing.title}</span> for your{' '}
                    <span className="font-medium text-[#2c2c2c]">{offer.targetListing.title}</span>
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
    | { kind: 'sent-offer'; timestamp: string; offer: SentOfferSummary }

export function ConversationsList({
    conversations: initialConversations,
    offers: initialOffers,
    sentOffers: initialSentOffers,
    sentOffersError,
}: {
    conversations: ConversationSummary[]
    offers: OfferSummary[]
    sentOffers: SentOfferSummary[]
    sentOffersError: string | null
}) {
    const [conversations, setConversations] = useState(initialConversations)
    const [offers, setOffers] = useState(initialOffers)
    const [sentOffers, setSentOffers] = useState(initialSentOffers)
    const [tab, setTab] = useState<'notifications' | 'messages'>('notifications')
    const [statusAnnouncement, setStatusAnnouncement] = useState('')
    const notificationsTabRef = useRef<HTMLButtonElement>(null)

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
        ...sentOffers.map((offer): NotificationItem => ({
            kind: 'sent-offer',
            timestamp: offer.updatedAt,
            offer,
        })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    function handleOfferResolved(offerId: string) {
        setOffers((current) => current.filter((offer) => offer.offerId !== offerId))
    }

    function handleSentOfferChanged(offerId: string, offeredListing: OfferableListing) {
        setSentOffers((current) => current.map((offer) => offer.offerId === offerId
            ? { ...offer, offeredListing, updatedAt: new Date().toISOString() }
            : offer))
    }

    function handleSentOfferWithdrawn(offerId: string, targetListingTitle: string) {
        setSentOffers((current) => current.filter((offer) => offer.offerId !== offerId))
        setStatusAnnouncement('')
        requestAnimationFrame(() => {
            setStatusAnnouncement(`Offer for ${targetListingTitle} was withdrawn.`)
            notificationsTabRef.current?.focus()
        })
    }

    function handleRequestResolved(conversationId: string) {
        setConversations((current) => current.filter((c) => c.id !== conversationId))
    }

    return (
        <div className="w-full max-w-md">
            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {statusAnnouncement}
            </p>
            <h1 className="mb-6 text-3xl font-semibold text-[#30392d]">Messages</h1>

            <div className="mb-4 flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
                    ref={notificationsTabRef}
                    onClick={() => setTab('notifications')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                        tab === 'notifications' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
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
                        tab === 'messages' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Messages
                </button>
            </div>

            {tab === 'notifications' && (
                <div className="flex flex-col gap-3">
                    {sentOffersError && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700 shadow-sm"
                        >
                            {sentOffersError}
                        </div>
                    )}

                    {notifications.length === 0 ? (
                        <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                            <p className="text-sm text-[#625f58]">
                                {sentOffersError ? 'No other notifications right now.' : 'No notifications right now.'}
                            </p>
                        </div>
                    ) : (
                        notifications.map((item) =>
                            item.kind === 'request' ? (
                                <RequestCard
                                    key={item.conversation.id}
                                    conversation={item.conversation}
                                    onResolved={handleRequestResolved}
                                />
                            ) : item.kind === 'offer' ? (
                                <OfferCard key={item.offer.offerId} offer={item.offer} onResolved={handleOfferResolved} />
                            ) : (
                                <SentOfferCard
                                    key={item.offer.offerId}
                                    offer={item.offer}
                                    onChanged={handleSentOfferChanged}
                                    onWithdrawn={handleSentOfferWithdrawn}
                                />
                            )
                        )
                    )}
                </div>
            )}

            {tab === 'messages' && (
                messages.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No conversations yet.</p>
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
