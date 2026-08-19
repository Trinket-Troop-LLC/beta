'use client'

import Link from 'next/link'
import { LoaderCircle, PackageSearch, Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import {
    ListingBrowseCard,
    type ListingBrowseCardData,
} from '@/components/listings/listing-browse-card'
import type { ListingFeedCursor } from '@/lib/listings/feed'
import { getMoreListings } from './actions'

export function TroopFeed({
    initialListings,
    initialCursor,
    initialHasPartialMediaError,
}: {
    initialListings: ListingBrowseCardData[]
    initialCursor: ListingFeedCursor | null
    initialHasPartialMediaError: boolean
}) {
    const [listings, setListings] = useState(initialListings)
    const [nextCursor, setNextCursor] = useState(initialCursor)
    const [hasPartialMediaError, setHasPartialMediaError] = useState(
        initialHasPartialMediaError,
    )
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function loadMore() {
        if (!nextCursor || isPending) {
            return
        }

        setError(null)
        const requestedCursor = nextCursor

        startTransition(async () => {
            let result: Awaited<ReturnType<typeof getMoreListings>>

            try {
                result = await getMoreListings(requestedCursor)
            } catch {
                setError('We could not load more listings. Check your connection and try again.')
                return
            }

            if (!result.success) {
                setError(result.error)
                return
            }

            setListings((current) => {
                const knownIds = new Set(current.map((listing) => listing.id))
                return [
                    ...current,
                    ...result.listings.filter((listing) => !knownIds.has(listing.id)),
                ]
            })
            setNextCursor(result.nextCursor)
            setHasPartialMediaError(
                (current) => current || result.hasPartialMediaError,
            )
        })
    }

    if (listings.length === 0) {
        return (
            <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-sm">
                <PackageSearch className="mx-auto size-9 text-primary" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                    The shelf is waiting for its first finds
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    No one in the troop has an active listing yet — including you. Post the first one.
                </p>
                <Link
                    href="/posts"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    Post a trinket
                </Link>
            </div>
        )
    }

    return (
        <div>
            {hasPartialMediaError && (
                <p
                    className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
                    role="status"
                >
                    A few photos or member details could not load, so placeholders are shown instead.
                </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {listings.map((listing) => (
                    <Link
                        key={listing.id}
                        href={`/troop/listings/${listing.id}`}
                        className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        <ListingBrowseCard listing={listing} />
                    </Link>
                ))}
            </div>

            <div className="mt-6" aria-live="polite">
                {error && (
                    <p className="mb-3 text-center text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}

                {nextCursor && (
                    <button
                        type="button"
                        onClick={loadMore}
                        disabled={isPending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-3 text-sm font-semibold text-primary transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending && (
                            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        )}
                        {isPending ? 'Loading more finds…' : 'Load more'}
                    </button>
                )}
            </div>
        </div>
    )
}
