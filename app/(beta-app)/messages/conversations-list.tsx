'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { ImageIcon, UserRound } from 'lucide-react'
import { acceptListingOffer, declineListingOffer } from '../troop/listing-lifecycle-actions'
import { acceptConversationRequest, declineConversationRequest } from './actions'

type ConversationSummary = {
    id: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    otherUser: {
        id: string
        username: string
        profilePictureUrl: string | null
    }
    lastMessagePreview: string | null
    updatedAt: string
}

type OfferSummary = {
    offerId: string
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
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                {conversation.otherUser.profilePictureUrl ? (
                    <Image
                        src={conversation.otherUser.profilePictureUrl}
                        alt={`${conversation.otherUser.username}'s profile picture`}
                        width={48}
                        height={48}
                        className="size-full object-cover"
                    />
                ) : (
                    <UserRound className="size-6 text-[#9aaa90]" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-[#2c2c2c]">@{conversation.otherUser.username}</p>
                    {conversation.status === 'pending' && (
                        <span className="rounded-full border border-[#ded8cc] px-2 py-0.5 text-xs font-medium text-[#7c8072]">
                            Pending
                        </span>
                    )}
                </div>
                <p className="truncate text-sm text-[#7c8072]">
                    {conversation.lastMessagePreview ?? 'Say hello!'}
                </p>
            </div>
        </Link>
    )
}

function RequestRow({
    conversation,
    onResolved,
}: {
    conversation: ConversationSummary
    onResolved: (conversationId: string) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleAccept() {
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
        <div className="flex flex-col gap-2 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                    {conversation.otherUser.profilePictureUrl ? (
                        <Image
                            src={conversation.otherUser.profilePictureUrl}
                            alt={`${conversation.otherUser.username}'s profile picture`}
                            width={48}
                            height={48}
                            className="size-full object-cover"
                        />
                    ) : (
                        <UserRound className="size-6 text-[#9aaa90]" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#2c2c2c]">@{conversation.otherUser.username}</p>
                    <p className="truncate text-sm text-[#7c8072]">
                        {conversation.lastMessagePreview ?? 'Say hello!'}
                    </p>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={handleAccept}
                    disabled={isPending}
                    className="rounded-lg bg-[#7c9272] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Accept
                </button>
                <button
                    type="button"
                    onClick={handleDecline}
                    disabled={isPending}
                    className="rounded-lg border border-[#ded8cc] px-3 py-1.5 text-xs font-medium text-[#7c8072] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Decline
                </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    )
}

function OfferRow({
    offer,
    onResolved,
}: {
    offer: OfferSummary
    onResolved: (offerId: string) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleAccept() {
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
        <div className="flex flex-col gap-2 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 shadow-sm">
            <p className="text-xs text-[#7c8072]">
                Offer on <span className="font-medium text-[#2c2c2c]">{offer.targetListing.title}</span>
            </p>
            <div className="flex items-center gap-3">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[#f2ede0]">
                    {offer.offeredListing.coverPhotoUrl ? (
                        <Image
                            src={offer.offeredListing.coverPhotoUrl}
                            alt={offer.offeredListing.title}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center text-[#9aaa90]">
                            <ImageIcon className="size-5" />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#2c2c2c]">{offer.offeredListing.title}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-[#7c8072]">
                        <UserRound className="size-3 shrink-0" />
                        @{offer.offerer.username}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={handleAccept}
                        disabled={isPending}
                        className="rounded-lg bg-[#7c9272] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Accept
                    </button>
                    <button
                        type="button"
                        onClick={handleDecline}
                        disabled={isPending}
                        className="rounded-lg border border-[#ded8cc] px-3 py-1.5 text-xs font-medium text-[#7c8072] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Decline
                    </button>
                </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    )
}

export function ConversationsList({
    conversations: initialConversations,
    offers: initialOffers,
}: {
    conversations: ConversationSummary[]
    offers: OfferSummary[]
}) {
    const [conversations, setConversations] = useState(initialConversations)
    const [offers, setOffers] = useState(initialOffers)

    const active = conversations.filter((c) => c.status === 'active')
    const needsMyResponse = conversations.filter((c) => c.status === 'pending' && !c.initiatedByMe)
    const waitingOnThem = conversations.filter((c) => c.status === 'pending' && c.initiatedByMe)

    const requestsBadgeCount = needsMyResponse.length + offers.length

    const [tab, setTab] = useState<'active' | 'requests' | 'offers'>(
        requestsBadgeCount > 0 ? 'requests' : 'active'
    )

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
                    onClick={() => setTab('active')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                        tab === 'active' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Messages
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                        tab === 'requests' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Requests
                    {needsMyResponse.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">
                            {needsMyResponse.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('offers')}
                    className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                        tab === 'offers' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Offers
                    {offers.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">
                            {offers.length}
                        </span>
                    )}
                </button>
            </div>

            {tab === 'active' && (
                active.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No active conversations yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {active.map((c) => <ConversationRow key={c.id} conversation={c} />)}
                    </div>
                )
            )}

            {tab === 'requests' && (
                needsMyResponse.length === 0 && waitingOnThem.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No pending requests.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {needsMyResponse.map((c) => (
                            <RequestRow key={c.id} conversation={c} onResolved={handleRequestResolved} />
                        ))}
                        {waitingOnThem.map((c) => <ConversationRow key={c.id} conversation={c} />)}
                    </div>
                )
            )}

            {tab === 'offers' && (
                offers.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No pending offers.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {offers.map((offer) => (
                            <OfferRow key={offer.offerId} offer={offer} onResolved={handleOfferResolved} />
                        ))}
                    </div>
                )
            )}
        </div>
    )
}