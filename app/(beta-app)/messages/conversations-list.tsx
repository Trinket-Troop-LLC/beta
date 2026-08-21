'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { acceptListingOffer, declineListingOffer } from '../troop/listing-lifecycle-actions'
import { acceptConversationRequest, declineConversationRequest } from './actions'
import { formatLastActive } from '@/lib/last-active'
import { Avatar, NotificationCard } from '@/components/messages/notification-card'

type ConversationSummary = {
    id: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    otherUser: {
        id: string
        username: string
        profilePictureUrl: string | null
        lastActiveAt: string | null
    }
    lastMessagePreview: string | null
    updatedAt: string
}

type OfferSummary = {
    offerId: string
    createdAt: string
    targetListing: { id: string; title: string }
    offerer: { id: string; username: string; profilePictureUrl: string | null }
    offeredListing: { id: string; title: string; coverPhotoUrl: string | null }
}

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
    return (
        <Link
            href={`/messages/${conversation.id}`}
            className="flex items-center gap-3 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 shadow-sm transition hover:bg-[#f5efe5]"
        >
            <Avatar username={conversation.otherUser.username} profilePictureUrl={conversation.otherUser.profilePictureUrl} />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-[#2c2c2c]">@{conversation.otherUser.username}</p>
                    {conversation.status === 'pending' && conversation.initiatedByMe && (
                        <span className="rounded-full border border-[#ded8cc] px-2 py-0.5 text-xs font-medium text-[#7c8072]">
                            Pending
                        </span>
                    )}
                </div>
                <p className="truncate text-sm text-[#7c8072]">
                    {conversation.lastMessagePreview ?? 'Say hello!'}
                </p>
                {conversation.status === 'active' && (
                    <p className="text-xs text-[#9aa494]">
                        {formatLastActive(conversation.otherUser.lastActiveAt)}
                    </p>
                )}
            </div>
        </Link>
    )
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
            <h1 className="mb-6 text-3xl font-semibold text-[#30392d]">Messages</h1>

            <div className="mb-4 flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
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
                notifications.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No notifications right now.</p>
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
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No conversations yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((c) => <ConversationRow key={c.id} conversation={c} />)}
                    </div>
                )
            )}
        </div>
    )
}
