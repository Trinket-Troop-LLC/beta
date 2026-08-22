'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition, type FormEvent } from 'react'
import { ImageIcon } from 'lucide-react'
import { requestConversation } from '@/app/(beta-app)/messages/actions'
import { getMyOfferableListings, submitListingOffer } from '../../listing-lifecycle-actions'
import { formatListingPrice, type ListingTransactionType } from '@/lib/listings/domain'

type OfferableListing = { id: string; title: string; coverPhotoUrl: string | null }
type RequestableType = 'sell' | 'gift' | 'lend'
type CannedMessageRequestType = Exclude<RequestableType, 'sell'>

function defaultRequestMessage(type: CannedMessageRequestType, title: string) {
    switch (type) {
        case 'gift':
            return `Hi! I'd love to take "${title}" off your hands.`
        case 'lend':
            return `Hi! Could I borrow "${title}"?`
    }
}

function requestButtonLabel(type: RequestableType, priceCents: number | null) {
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
    const buyRequestId = useId()
    const [activeType, setActiveType] = useState<ListingTransactionType | null>(null)
    const [buyMessage, setBuyMessage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const [offerableListings, setOfferableListings] = useState<OfferableListing[] | null>(null)
    const [selectedOfferListingId, setSelectedOfferListingId] = useState<string | null>(null)
    const [offerSent, setOfferSent] = useState(false)

    function submitRequest(type: RequestableType, message: string) {
        setError(null)
        setActiveType(type)
        startTransition(async () => {
            const result = await requestConversation(ownerId, listingId, message, 'listing', type)

            if (!result.success) {
                setError(result.error ?? 'Could not send your request. Please try again.')
                return
            }

            router.push(`/messages/${result.conversationId}`)
        })
    }

    function handleCannedRequest(type: CannedMessageRequestType) {
        submitRequest(type, defaultRequestMessage(type, listingTitle))
    }

    function handleOpenBuyRequest() {
        setError(null)
        if (activeType !== 'sell') setBuyMessage('')
        setActiveType('sell')
    }

    function handleSubmitBuyRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        submitRequest('sell', buyMessage)
    }

    function handleCancelBuyRequest() {
        if (isPending) return
        setError(null)
        setBuyMessage('')
        setActiveType(null)
    }

    function handleOpenTradePicker() {
        setError(null)
        setActiveType('trade')
        startTransition(async () => {
            const result = await getMyOfferableListings(listingId)
            if (!result.success) {
                setError(result.error ?? 'Could not load your listings.')
                return
            }
            setOfferableListings(result.listings)
        })
    }

    function handleSubmitOffer() {
        if (!selectedOfferListingId) return
        setError(null)
        startTransition(async () => {
            const result = await submitListingOffer(listingId, selectedOfferListingId)
            if (!result.success) {
                setError(result.error ?? 'Could not send your offer. Please try again.')
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
                                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {offerSent ? 'Offer sent' : 'Offer a trade'}
                            </button>

                            {activeType === 'trade' && offerableListings !== null && !offerSent && (
                                <div className="mt-2 rounded-lg border border-border p-3">
                                    {offerableListings.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            You don&apos;t have any active listings to offer yet.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="mb-2 text-sm text-muted-foreground">
                                                Pick one of your listings to offer:
                                            </p>
                                            <div className="flex flex-col gap-1.5">
                                                {offerableListings.map((listing) => (
                                                    <label
                                                        key={listing.id}
                                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition ${
                                                            selectedOfferListingId === listing.id
                                                                ? 'border-primary bg-secondary'
                                                                : 'border-border'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="offer-listing"
                                                            value={listing.id}
                                                            checked={selectedOfferListingId === listing.id}
                                                            onChange={() => setSelectedOfferListingId(listing.id)}
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
                                            <button
                                                type="button"
                                                onClick={handleSubmitOffer}
                                                disabled={!selectedOfferListingId || isPending}
                                                className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Send offer
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                case 'sell':
                    return (
                        <div key="sell">
                            <button
                                type="button"
                                onClick={handleOpenBuyRequest}
                                disabled={isPending}
                                aria-expanded={activeType === 'sell'}
                                aria-controls={`${buyRequestId}-form`}
                                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {requestButtonLabel(type, priceCents)}
                            </button>

                            {activeType === 'sell' && (
                                <form
                                    id={`${buyRequestId}-form`}
                                    onSubmit={handleSubmitBuyRequest}
                                    className="mt-2 space-y-3 rounded-lg border border-border p-3"
                                    aria-labelledby={`${buyRequestId}-heading`}
                                    aria-busy={isPending}
                                >
                                    <div>
                                        <h3 id={`${buyRequestId}-heading`} className="text-sm font-semibold text-foreground">
                                            Send a buy request
                                        </h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            You can include a message, or send the request without one.
                                        </p>
                                    </div>

                                    <div>
                                        <label htmlFor={`${buyRequestId}-message`} className="text-sm font-medium text-foreground">
                                            Message <span className="font-normal text-muted-foreground">(optional)</span>
                                        </label>
                                        <textarea
                                            id={`${buyRequestId}-message`}
                                            value={buyMessage}
                                            onChange={(event) => setBuyMessage(event.target.value)}
                                            maxLength={1000}
                                            rows={4}
                                            disabled={isPending}
                                            placeholder="Add a note for the seller"
                                            aria-describedby={`${buyRequestId}-message-count`}
                                            className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                        <p
                                            id={`${buyRequestId}-message-count`}
                                            className="mt-1 text-right text-xs text-muted-foreground"
                                        >
                                            {buyMessage.length}/1000
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="submit"
                                            disabled={isPending}
                                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isPending ? 'Sending...' : 'Send buy request'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelBuyRequest}
                                            disabled={isPending}
                                            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )
                case 'gift':
                case 'lend':
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => handleCannedRequest(type)}
                            disabled={isPending}
                            className="rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isPending && activeType === type
                                ? 'Sending…'
                                : requestButtonLabel(type, priceCents)}
                        </button>
                    )
                default:
                    // Exhaustiveness check: a new ListingTransactionType added
                    // to lib/listings/domain.ts without a case above fails to
                    // compile here instead of silently rendering no button.
                    return type satisfies never
                }
            })}

            {error && (
                <p className="text-sm text-red-600" role="alert">{error}</p>
            )}
        </div>
    )
}
