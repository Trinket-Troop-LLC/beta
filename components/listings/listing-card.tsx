import Image from 'next/image'
import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import {
    LISTING_CATEGORY_LABELS,
    LISTING_CONDITION_LABELS,
    LISTING_STATUS_LABELS,
    LISTING_TRANSACTION_TYPE_LABELS,
    formatListingPrice,
    type Listing,
} from '@/lib/listings/domain'
import { CategoryPlaceholder } from './category-placeholder'

export type ListingCardData = Pick<
    Listing,
    | 'id'
    | 'title'
    | 'category'
    | 'other_category'
    | 'condition'
    | 'transaction_types'
    | 'price_cents'
    | 'pickup_area'
    | 'status'
    | 'published_at'
> & {
    coverPhotoUrl: string | null
}

export function ListingCard({
    listing,
    footer,
    statusLabelOverride,
}: {
    listing: ListingCardData
    footer?: ReactNode
    statusLabelOverride?: string
}) {
    const sharingLabels = listing.transaction_types.map((type) =>
        type === 'sell' && listing.price_cents !== null
            ? formatListingPrice(listing.price_cents)
            : LISTING_TRANSACTION_TYPE_LABELS[type],
    )
    const categoryLabel = listing.category === 'other'
        ? listing.other_category ?? LISTING_CATEGORY_LABELS.other
        : LISTING_CATEGORY_LABELS[listing.category]
    const isReserved = listing.status === 'reserved'

    return (
        <article className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm">
            <div className="relative aspect-square bg-secondary">
                {listing.coverPhotoUrl ? (
                    <Image
                        src={listing.coverPhotoUrl}
                        alt={listing.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 320px"
                        className={`object-cover ${isReserved ? 'grayscale-[50%] opacity-40' : ''}`}
                    />
                ) : (
                    <CategoryPlaceholder category={listing.category} />
                )}

                {(listing.status !== 'active' || statusLabelOverride) && (
                    <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                        {statusLabelOverride ?? LISTING_STATUS_LABELS[listing.status]}
                    </span>
                )}
            </div>

            <div className="p-4">
                <div className="min-w-0">
                    <h3 className="break-words font-semibold leading-5 text-foreground">
                        {listing.title}
                    </h3>
                    <span className="mt-1 block break-words text-sm font-semibold text-primary">
                        {sharingLabels.join(' · ')}
                    </span>
                </div>

                <p className="mt-2 break-words text-sm text-muted-foreground">
                    {categoryLabel} · {LISTING_CONDITION_LABELS[listing.condition]}
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{listing.pickup_area}</span>
                </p>
            </div>

            {footer && (
                <div className="border-t border-border px-4 py-3">
                    {footer}
                </div>
            )}
        </article>
    )
}
