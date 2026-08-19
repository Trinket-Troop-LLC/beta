'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ImageIcon } from 'lucide-react'
import { requestConversation } from '@/app/(beta-app)/messages/actions'
import { getMyOfferableListings, submitListingOffer } from '../../listing-lifecycle-actions'
import { formatListingPrice, type ListingTransactionType } from '@/lib/listings/domain'

type OfferableListing = { id: string; title: string; coverPhotoUrl: string | null }
type RequestableType = 'sell' | 'gift' | 'lend'

function defaultRequestMessage(type: RequestableType, title: string, priceCents: number | null) {
    switch (type) {
        case 'sell':
            return priceCents !== null
                ? `Hi! I'd like to buy "${title}" for ${formatListingPrice(priceCents)}.`
                : `Hi! I'd like to buy "${title}".`
        case 'gift':
            return `Hi! I'd love to take "${title}" off your hands.`
        case 'lend':
            return `Hi! Could I borrow "${title}"?`
    }
}

function openButtonLabel(type: RequestableType, priceCents: number | null) {
    switch (type) {
        case 'sell':
            return priceCents !== null ? `Buy for ${formatListingPrice(priceCents)}` : 'Buy'
        case 'gift':
            return 'Request it'
        case 'lend':
            return 'Request to borrow'
    }
}

export function ExchangeActions({
    listingId,
    listingTitle,
    ownerId,
    transactionTypes,
    priceCents,
}: {
    listingId: string
    listingTitle: string
    ownerId: string
    transactionTypes: ListingTransactionType[]
    priceCents: number | null
}) {
    const router = useRouter()
    const [activeType, setActiveType] = useState<ListingTransactionType | null>(null)
    const [requestMessage, setRequestMessage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const [offerableListings, setOfferableListings] = useState<OfferableListing[] | null>(null)
    const [selectedOfferListingId, setSelectedOfferListingId] = useState<string | null>(null)
    const [tradeMessage, setTradeMessage] = useState('')
    const [offerSent, setOfferSent] = useState(false)

    function openRequestPanel(type: RequestableType) {
        setError(null)
        setActiveType(type)
        setRequestMessage(defaultRequestMessage(type, listingTitle, priceCents))
    }

    function handleSendRequest(type: RequestableType) {
        setError(null)
        startTransition(async () => {
            const result = await requestConversation(ownerId, listingId, requestMessage, 'listing', type)

            if (!result.success) {
                setError(result.error ?? 'Could not send your request. Please try again.')
                return
            }

            router.push(`/messages/${result.conversationId}`)
        })
    }

    function handleOpenTradePicker() {
        setError(null)
        setActiveType('trade')
        setTradeMessage('')
        startTransition(async () => {
            const result = await getMyOfferableListings(listingId)
            if (!result.success) {
                setError(result.error ?? 'Could not load your listings.')
                return
            }
            setOfferableListings(result.listings)
        })
    }

    function handleSubmitTrade() {
        const trimmedMessage = tradeMessage.trim()

        if (!selectedOfferListingId && !trimmedMessage) {
            setError("Choose one of your listings to offer, or write a message explaining what you'd like to trade.")
            return
        }

        setError(null)
        startTransition(async () => {
            const result = selectedOfferListingId
                ? await submitListingOffer(listingId, selectedOfferListingId)
                : await requestConversation(ownerId, listingId, trimmedMessage, 'listing', 'trade')

            if (!result.success) {
                setError(result.error ?? 'Could not send your offer. Please try again.')
                return
            }

            if ('conversationId' in result) {
                router.push(`/messages/${result.conversationId}`)
                return
            }

            setOfferSent(true)
        })
    }

    return (
        <div className="mt-6 flex flex-col gap-2">
            {transactionTypes.map((type) => {
                switch (type) {
                case 'trade':
                    return (
                        <div key="trade">
                            <button
                                type="button"
                                onClick={handleOpenTradePicker}
                                disabled={isPending || offerSent}
                                className="w-full rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {offerSent ? 'Offer sent' : 'Offer a trade'}
                            </button>

                            {activeType === 'trade' && offerableListings !== null && !offerSent && (
                                <div className="mt-2 rounded-lg border border-border p-3">
                                    {offerableListings.length > 0 && (
                                        <>
                                            <p className="mb-2 text-sm text-muted-foreground">
                                                Pick one of your listings to offer (optional):
                                            </p>
                                            <div className="flex flex-col gap-1.5">
                                                {offerableListings.map((listing) => (
                                                    <label
                                                        key={listing.id}
                                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition ${
                                                            selectedOfferListingId === listing.id
                                                                ? 'border-[#7c9272] bg-[#e4e8d8]'
                                                                : 'border-border'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="offer-listing"
                                                            value={listing.id}
                                                            checked={selectedOfferListingId === listing.id}
                                                            onChange={() =>
                                                                setSelectedOfferListingId(
                                                                    selectedOfferListingId === listing.id ? null : listing.id,
                                                                )
                                                            }
                                                            onClick={() => {
                                                                if (selectedOfferListingId === listing.id) {
                                                                    setSelectedOfferListingId(null)
                                                                }
                                                            }}
                                                            className="shrink-0"
                                                        />
                                                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                                                            {listing.coverPhotoUrl ? (
                                                                <Image
                                                                    src={listing.coverPhotoUrl}
                                                                    alt={listing.title}
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                                                    <ImageIcon className="size-4" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="truncate text-sm text-foreground">{listing.title}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    <label className="mt-3 block text-sm text-muted-foreground" htmlFor="trade-message">
                                        Message{selectedOfferListingId ? ' (optional)' : ''}
                                    </label>
                                    <textarea
                                        id="trade-message"
                                        value={tradeMessage}
                                        onChange={(event) => setTradeMessage(event.target.value)}
                                        rows={3}
                                        placeholder={
                                            selectedOfferListingId
                                                ? 'Add a note (optional)...'
                                                : "Say what you'd like to trade for..."
                                        }
                                        className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleSubmitTrade}
                                        disabled={isPending}
                                        className="mt-3 w-full rounded-lg bg-[#7c9272] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Send offer
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                case 'sell':
                case 'gift':
                case 'lend':
                    return (
                        <div key={type}>
                            <button
                                type="button"
                                onClick={() => openRequestPanel(type)}
                                disabled={isPending}
                                className="w-full rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {openButtonLabel(type, priceCents)}
                            </button>

                            {activeType === type && (
                                <div className="mt-2 rounded-lg border border-border p-3">
                                    <label className="block text-sm text-muted-foreground" htmlFor={`${type}-message`}>
                                        Message (optional)
                                    </label>
                                    <textarea
                                        id={`${type}-message`}
                                        value={requestMessage}
                                        onChange={(event) => setRequestMessage(event.target.value)}
                                        rows={3}
                                        className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSendRequest(type)}
                                        disabled={isPending}
                                        className="mt-3 w-full rounded-lg bg-[#7c9272] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isPending ? 'Sending…' : 'Send'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                default:
                    // Exhaustiveness check: a new ListingTransactionType added
                    // to lib/listings/domain.ts without a case above fails to
                    // compile here instead of silently rendering no button.
                    return type satisfies never
                }
            })}

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}
