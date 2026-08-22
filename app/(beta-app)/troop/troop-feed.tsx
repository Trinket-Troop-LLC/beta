'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ListingBrowseCard, type ListingBrowseCardData } from '@/components/listings/listing-browse-card'
import { getListingsView, type ListingFeedCursor, type ListingFeedScope } from './actionts'

const scopeLabels: Record<ListingFeedScope, string> = {
    everything: 'everything',
    'my-troop': 'my troop',
}

const emptyStateMessage: Record<ListingFeedScope, string> = {
    everything: 'No listings yet — be the first to post a listing!',
    'my-troop': "None of your troop has posted yet — check back later, or browse everything instead.",
}

export function TroopFeed({
    initialListings,
    initialCursor,
}: {
    initialListings: ListingBrowseCardData[]
    initialCursor: ListingFeedCursor | null
}) {
    const [scope, setScope] = useState<ListingFeedScope>('everything')
    const [listings, setListings] = useState(initialListings)
    const [nextCursor, setNextCursor] = useState(initialCursor)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function loadMore() {
        if (!nextCursor || isPending) return

        setError(null)
        const requestedCursor = nextCursor

        startTransition(async () => {
            const result = await getListingsView(requestedCursor, scope)

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

    function switchScope(nextScope: ListingFeedScope) {
        if (nextScope === scope || isPending) return

        setScope(nextScope)
        setError(null)

        startTransition(async () => {
            const result = await getListingsView(null, nextScope)

            if (!result.success) {
                setError(result.error)
                return
            }

            setListings(result.listings)
            setNextCursor(result.nextCursor)
        })
    }

    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger className="mb-4 inline-flex items-center gap-1 text-lg font-semibold text-foreground focus-visible:outline-none">
                    {scopeLabels[scope]}
                    <ChevronDown className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {(Object.keys(scopeLabels) as ListingFeedScope[]).map((option) => (
                        <DropdownMenuItem key={option} onSelect={() => switchScope(option)}>
                            <Check className={`mr-2 size-4 ${option === scope ? 'opacity-100' : 'opacity-0'}`} />
                            {scopeLabels[option]}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyStateMessage[scope]}</p>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {listings.map((listing) => (
                        <Link key={listing.id} href={`/troop/listings/${listing.id}`}>
                            <ListingBrowseCard listing={listing} />
                        </Link>
                    ))}
                </div>
            )}

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
