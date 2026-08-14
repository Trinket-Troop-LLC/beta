'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ListingBrowseCard, type ListingBrowseCardData } from '@/components/listings/listing-browse-card'
import { getListingsView } from './actionts'

export function TroopFeed({
    initialListings,
    initialHasMore,
}: {
    initialListings: ListingBrowseCardData[]
    initialHasMore: boolean
}) {
    const [listings, setListings] = useState(initialListings)
    const [hasMore, setHasMore] = useState(initialHasMore)
    const [page, setPage] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function loadMore() {
        setError(null)
        startTransition(async () => {
            const nextPage = page + 1
            const result = await getListingsView(nextPage)

            if (!result.success) {
                setError(result.error)
                return
            }

            setListings((current) => [...current, ...result.listings])
            setHasMore(result.hasMore)
            setPage(nextPage)
        })
    }

    if (listings.length === 0) {
        return (
            <p className="text-sm text-[#625f58]">
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

            {hasMore && (
                <button
                    type="button"
                    onClick={loadMore}
                    disabled={isPending}
                    className="mt-6 w-full rounded-full border border-[#ded8cc] py-2.5 text-sm font-medium text-[#5f7258] disabled:opacity-60"
                >
                    {isPending ? 'Loading…' : 'Load more'}
                </button>
            )}
        </div>
    )
}
