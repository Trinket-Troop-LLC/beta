'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ListingBrowseCard, type ListingBrowseCardData } from '@/components/listings/listing-browse-card'
import { getListingsView, type ListingFeedCursor } from './actionts'

export function TroopFeed({
    initialListings,
    initialCursor,
}: {
    initialListings: ListingBrowseCardData[]
    initialCursor: ListingFeedCursor | null
}) {
    const [listings, setListings] = useState(initialListings)
    const [nextCursor, setNextCursor] = useState(initialCursor)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function loadMore() {
        if (!nextCursor || isPending) return

        setError(null)
        const requestedCursor = nextCursor

        startTransition(async () => {
            const result = await getListingsView(requestedCursor)

            if (!result.success) {
                setError(result.error)
                return
            }

            setListings((current) => {
                // Keyset pagination shouldn't produce overlap, but this stays
                // as a cheap safety net against duplicate React keys if a
                // page is ever re-requested.
                const knownIds = new Set(current.map((listing) => listing.id))
                return [
                    ...current,
                    ...result.listings.filter((listing) => !knownIds.has(listing.id)),
                ]
            })
            setNextCursor(result.nextCursor)
        })
    }

    if (listings.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No listings yet — be the first to post a listing!
            </p>
        )
    }

    return (
        <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {listings.map((listing) => (
                    <Link key={listing.id} href={`/troop/listings/${listing.id}`}>
                        <ListingBrowseCard listing={listing} />
                    </Link>
                ))}
            </div>

            {error && (
                <p className="mt-4 text-sm text-red-600">{error}</p>
            )}

            {nextCursor && (
                <button
                    type="button"
                    onClick={loadMore}
                    disabled={isPending}
                    className="mt-6 w-full rounded-full border border-border py-2.5 text-sm font-medium text-primary disabled:opacity-60"
                >
                    {isPending ? 'Loading…' : 'Load more'}
                </button>
            )}
        </div>
    )
}
