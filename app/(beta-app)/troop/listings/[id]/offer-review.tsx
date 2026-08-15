'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ImageIcon, UserRound } from 'lucide-react'
import { acceptListingOffer, declineListingOffer } from '../../listing-lifecycle-actions'

type OfferSummary = {
    offerId: string
    offerer: { id: string; username: string; profilePictureUrl: string | null }
    offeredListing: { id: string; title: string; coverPhotoUrl: string | null }
}

export function OfferReview({ offers: initialOffers }: { offers: OfferSummary[] }) {
    const router = useRouter()
    const [offers, setOffers] = useState(initialOffers)
    const [pendingOfferId, setPendingOfferId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleAccept(offerId: string) {
        setError(null)
        setPendingOfferId(offerId)
        startTransition(async () => {
            const result = await acceptListingOffer(offerId)
            if (!result.success) {
                setError(result.error ?? 'Could not accept this offer.')
                return
            }
            router.push(`/messages/${result.conversationId}`)
        })
    }

    function handleDecline(offerId: string) {
        setError(null)
        setPendingOfferId(offerId)
        startTransition(async () => {
            const result = await declineListingOffer(offerId)
            if (!result.success) {
                setError(result.error ?? 'Could not decline this offer.')
                return
            }
            setOffers((current) => current.filter((offer) => offer.offerId !== offerId))
        })
    }

    if (offers.length === 0) return null

    return (
        <div className="mt-6 rounded-2xl border border-border p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Trade offers
            </h2>
            <div className="mt-3 flex flex-col gap-3">
                {offers.map((offer) => (
                    <div key={offer.offerId} className="flex items-center gap-3 rounded-xl border border-border p-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                            {offer.offeredListing.coverPhotoUrl ? (
                                <Image
                                    src={offer.offeredListing.coverPhotoUrl}
                                    alt={offer.offeredListing.title}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                    <ImageIcon className="size-5" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{offer.offeredListing.title}</p>
                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <UserRound className="size-3 shrink-0" />
                                @{offer.offerer.username}
                            </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <button
                                type="button"
                                onClick={() => handleAccept(offer.offerId)}
                                disabled={isPending}
                                className="rounded-lg bg-[#7c9272] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isPending && pendingOfferId === offer.offerId ? '…' : 'Accept'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDecline(offer.offerId)}
                                disabled={isPending}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
    )
}
