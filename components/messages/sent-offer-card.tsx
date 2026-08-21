'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { ListingPlaceholder } from '@/components/listings/listing-placeholder'
import { formatTimestamp } from '@/lib/format-timestamp'
import {
    getMyOfferableListings,
    updatePendingListingOffer,
    withdrawPendingListingOffer,
} from '@/app/(beta-app)/troop/listing-lifecycle-actions'

export type OfferableListing = {
    id: string
    title: string
    coverPhotoUrl: string | null
}

export type SentOfferSummary = {
    offerId: string
    createdAt: string
    updatedAt: string
    targetListing: { id: string; title: string }
    targetOwner: { id: string; username: string; profilePictureUrl: string | null }
    offeredListing: OfferableListing
}

export function SentOfferCard({
    offer,
    onChanged,
    onWithdrawn,
}: {
    offer: SentOfferSummary
    onChanged: (offerId: string, offeredListing: OfferableListing) => void
    onWithdrawn: (offerId: string, targetListingTitle: string) => void
}) {
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [offerableListings, setOfferableListings] = useState<OfferableListing[] | null>(null)
    const [selectedListingId, setSelectedListingId] = useState(offer.offeredListing.id)
    const [isLoadingChoices, setIsLoadingChoices] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false)
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const withdrawButtonRef = useRef<HTMLButtonElement>(null)
    const confirmWithdrawButtonRef = useRef<HTMLButtonElement>(null)
    const shouldRestoreWithdrawFocus = useRef(false)

    const isBusy = isLoadingChoices || isSaving || isWithdrawing
    const replacementListings = offerableListings?.filter(
        (listing) => listing.id !== offer.offeredListing.id,
    ) ?? []
    const pickerId = `sent-offer-picker-${offer.offerId}`
    const wasUpdated = offer.updatedAt !== offer.createdAt

    useEffect(() => {
        if (isConfirmingWithdraw) {
            confirmWithdrawButtonRef.current?.focus()
            return
        }

        if (shouldRestoreWithdrawFocus.current) {
            shouldRestoreWithdrawFocus.current = false
            withdrawButtonRef.current?.focus()
        }
    }, [isConfirmingWithdraw])

    async function handleChangeItem() {
        setError(null)
        setIsConfirmingWithdraw(false)

        if (isPickerOpen) {
            setIsPickerOpen(false)
            return
        }

        setSelectedListingId(offer.offeredListing.id)
        setIsPickerOpen(true)

        if (offerableListings !== null) return

        setIsLoadingChoices(true)

        try {
            const result = await getMyOfferableListings(offer.targetListing.id)

            if (!result.success) {
                setError(result.error ?? 'Could not load your available listings.')
                setIsPickerOpen(false)
                return
            }

            setOfferableListings(result.listings)
        } catch {
            setError('Could not load your available listings. Check your connection and try again.')
            setIsPickerOpen(false)
        } finally {
            setIsLoadingChoices(false)
        }
    }

    async function handleSaveChange() {
        const replacement = replacementListings.find((listing) => listing.id === selectedListingId)
        if (!replacement || isBusy) return

        setError(null)
        setIsSaving(true)

        try {
            const result = await updatePendingListingOffer(offer.offerId, replacement.id)

            if (!result.success) {
                setError(result.error ?? 'Could not change the item in this offer.')
                return
            }

            onChanged(offer.offerId, replacement)
            setSelectedListingId(replacement.id)
            setIsPickerOpen(false)
        } catch {
            setError('Could not change the item in this offer. Check your connection and try again.')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleWithdraw() {
        if (isBusy) return

        setError(null)
        setIsWithdrawing(true)

        try {
            const result = await withdrawPendingListingOffer(offer.offerId)

            if (!result.success) {
                setError(result.error ?? 'Could not withdraw this offer.')
                return
            }

            onWithdrawn(offer.offerId, offer.targetListing.title)
        } catch {
            setError('Could not withdraw this offer. Check your connection and try again.')
        } finally {
            setIsWithdrawing(false)
        }
    }

    return (
        <article
            aria-busy={isBusy}
            className="flex flex-col gap-3 rounded-[20px] border border-card-border/50 bg-request-card p-4 shadow-sm"
        >
            <div className="flex gap-3">
                <Avatar
                    username={offer.targetOwner.username}
                    profilePictureUrl={offer.targetOwner.profilePictureUrl}
                />

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-message-text">@{offer.targetOwner.username}</p>
                        <span className="rounded-full bg-[#e7eddf] px-2.5 py-1 text-xs font-semibold text-[#53664b]">
                            Offer sent
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-message-text">
                        You offered <span className="font-medium">{offer.offeredListing.title}</span> for{' '}
                        <span className="font-medium">{offer.targetListing.title}</span>.
                    </p>
                    <span className="mt-2 block text-xs italic text-message-text">
                        {wasUpdated ? 'Updated' : 'Sent'} {formatTimestamp(offer.updatedAt)}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-[#ded8cc] bg-white/55 p-2.5">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {offer.offeredListing.coverPhotoUrl ? (
                        <Image
                            src={offer.offeredListing.coverPhotoUrl}
                            alt={offer.offeredListing.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                        />
                    ) : (
                        <ListingPlaceholder title={offer.offeredListing.title} compact />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#77736b]">Your offered item</p>
                    <p className="truncate text-sm font-medium text-message-text">{offer.offeredListing.title}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    aria-expanded={isPickerOpen}
                    aria-controls={pickerId}
                    onClick={handleChangeItem}
                    disabled={isBusy}
                    className="rounded-md border border-black/50 bg-chat-action px-4 py-1 text-button font-medium text-chat-action-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isPickerOpen ? 'Cancel change' : 'Change item'}
                </button>
                {!isConfirmingWithdraw ? (
                    <button
                        ref={withdrawButtonRef}
                        type="button"
                        onClick={() => {
                            setError(null)
                            setIsPickerOpen(false)
                            setIsConfirmingWithdraw(true)
                        }}
                        disabled={isBusy}
                        className="rounded-md border border-black/50 bg-decline-action px-4 py-1 text-button font-medium text-decline-action-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Withdraw
                    </button>
                ) : (
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm offer withdrawal">
                        <span className="text-sm text-message-text">Withdraw this offer?</span>
                        <button
                            ref={confirmWithdrawButtonRef}
                            type="button"
                            onClick={handleWithdraw}
                            disabled={isBusy}
                            className="rounded-md border border-red-800/60 bg-red-700 px-3 py-1 text-button font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isWithdrawing ? 'Withdrawing...' : 'Yes, withdraw'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                shouldRestoreWithdrawFocus.current = true
                                setIsConfirmingWithdraw(false)
                            }}
                            disabled={isBusy}
                            className="rounded-md border border-black/30 bg-white/70 px-3 py-1 text-button font-medium text-message-text transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Keep offer
                        </button>
                    </div>
                )}
            </div>

            <div id={pickerId}>
                {isLoadingChoices && (
                    <p role="status" className="text-sm text-message-text">Loading your listings...</p>
                )}

                {isPickerOpen && !isLoadingChoices && offerableListings !== null && (
                    replacementListings.length === 0 ? (
                        <p className="rounded-xl border border-[#ded8cc] bg-white/55 p-3 text-sm text-message-text">
                            You do not have another active listing available to offer.
                        </p>
                    ) : (
                        <fieldset className="rounded-xl border border-[#ded8cc] bg-white/55 p-3">
                            <legend className="px-1 text-sm font-medium text-message-text">
                                Choose a replacement item
                            </legend>
                            <div className="mt-2 flex max-h-56 flex-col gap-2 overflow-y-auto">
                                {replacementListings.map((listing) => (
                                    <label
                                        key={listing.id}
                                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#ded8cc] bg-white/70 p-2 transition hover:bg-white has-[:checked]:border-[#7c9272] has-[:checked]:ring-1 has-[:checked]:ring-[#7c9272]"
                                    >
                                        <input
                                            type="radio"
                                            name={`replacement-listing-${offer.offerId}`}
                                            value={listing.id}
                                            checked={selectedListingId === listing.id}
                                            onChange={() => setSelectedListingId(listing.id)}
                                            disabled={isBusy}
                                            className="shrink-0"
                                        />
                                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-secondary">
                                            {listing.coverPhotoUrl ? (
                                                <Image
                                                    src={listing.coverPhotoUrl}
                                                    alt={listing.title}
                                                    fill
                                                    sizes="40px"
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <ListingPlaceholder title={listing.title} compact />
                                            )}
                                        </div>
                                        <span className="min-w-0 flex-1 truncate text-sm text-message-text">
                                            {listing.title}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveChange}
                                disabled={isBusy || !replacementListings.some(
                                    (listing) => listing.id === selectedListingId,
                                )}
                                className="mt-3 rounded-md border border-black/50 bg-chat-action px-4 py-1 text-button font-medium text-chat-action-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSaving ? 'Saving...' : 'Update offer'}
                            </button>
                        </fieldset>
                    )
                )}
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </article>
    )
}
