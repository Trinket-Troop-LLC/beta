import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import {
    LISTING_TRANSACTION_TYPE_LABELS,
    formatListingPrice,
    type Listing,
} from '@/lib/listings/domain'

export type ListingBrowseCardData = Pick<Listing, 'id' | 'title' | 'transaction_types' | 'price_cents' | 'status'> & {
    coverPhotoUrl: string | null
}

export function ListingBrowseCard({ listing }: { listing: ListingBrowseCardData }) {
    const sharingLabels = listing.transaction_types.map((type) =>
        type === 'sell' && listing.price_cents !== null
            ? formatListingPrice(listing.price_cents)
            : LISTING_TRANSACTION_TYPE_LABELS[type],
    )

    const isReserved = listing.status === 'reserved'

    return (
        <article className="text-left">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
                {listing.coverPhotoUrl ? (
                    <Image
                        src={listing.coverPhotoUrl}
                        alt={listing.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 240px"
                        className={`object-cover ${isReserved ? 'grayscale-[50%] opacity-40' : ''}`}
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-9" />
                    </div>
                )}
            </div>

            <div className="pt-2">
                <h3 className="truncate font-semibold leading-5 text-foreground">
                    {listing.title}
                </h3>
                <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                    {sharingLabels.join(' · ')}
                </span>
            </div>
        </article>
    )
}
