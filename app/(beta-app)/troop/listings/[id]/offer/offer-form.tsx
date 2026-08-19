'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ListingPhotoPlaceholder } from '@/components/listings/listing-photo-placeholder'
import { Button } from '@/components/ui/button'
import type { ListingCategory } from '@/lib/listings/domain'
import { requestListingOffer } from '../offer-actions'

export type OwnListingOption = {
    id: string
    title: string
    category: ListingCategory
    categoryLabel: string
    coverPhotoUrl: string | null
}

export function OfferForm({
    listingId,
    ownListings,
}: {
    listingId: string
    ownListings: OwnListingOption[]
}) {
    const router = useRouter()
    const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const messageRequired = selectedListingId === null

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault()

        const trimmedMessage = message.trim()

        if (messageRequired && !trimmedMessage) {
            setError('Write a message, or choose one of your own listings to offer instead.')
            return
        }

        setError(null)

        startTransition(async () => {
            const result = await requestListingOffer(listingId, selectedListingId, trimmedMessage)

            if (!result.success) {
                setError(result.error)
                return
            }

            router.push(`/messages/${result.conversationId}`)
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {ownListings.length > 0 && (
                <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Offer one of your own listings (optional)
                    </legend>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {ownListings.map((listing) => {
                            const isSelected = selectedListingId === listing.id

                            return (
                                <label
                                    key={listing.id}
                                    className={`block cursor-pointer overflow-hidden rounded-2xl border text-left shadow-sm transition ${
                                        isSelected
                                            ? 'border-primary ring-2 ring-primary'
                                            : 'border-border hover:bg-secondary'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="offeredListing"
                                        value={listing.id}
                                        checked={isSelected}
                                        onChange={() =>
                                            setSelectedListingId(isSelected ? null : listing.id)
                                        }
                                        onClick={() => {
                                            if (isSelected) setSelectedListingId(null)
                                        }}
                                        className="sr-only"
                                    />
                                    <div className="relative aspect-square bg-secondary">
                                        {listing.coverPhotoUrl ? (
                                            <Image
                                                src={listing.coverPhotoUrl}
                                                alt={listing.title}
                                                fill
                                                sizes="200px"
                                                className="object-cover"
                                            />
                                        ) : (
                                            <ListingPhotoPlaceholder
                                                category={listing.category}
                                                title={listing.title}
                                            />
                                        )}
                                    </div>
                                    <div className="p-2.5">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {listing.title}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {listing.categoryLabel}
                                        </p>
                                    </div>
                                </label>
                            )
                        })}
                    </div>
                </fieldset>
            )}

            <div>
                <label htmlFor="offer-message" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Message{messageRequired ? '' : ' (optional)'}
                </label>
                <textarea
                    id="offer-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    required={messageRequired}
                    maxLength={2000}
                    rows={4}
                    placeholder={
                        messageRequired
                            ? "Say what you're interested in and why."
                            : 'Add a note along with your offer (optional).'
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
            </div>

            {error && (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Sending offer…' : 'Send offer'}
            </Button>
        </form>
    )
}
