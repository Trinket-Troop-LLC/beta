import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { ListingPhotoPlaceholder } from '@/components/listings/listing-photo-placeholder'
import {
    LISTING_TRANSACTION_TYPE_LABELS,
    formatListingPrice,
    type Listing,
} from '@/lib/listings/domain'

export type ListingBrowseCardData = Pick<
    Listing,
    'id' | 'owner_id' | 'title' | 'category' | 'transaction_types' | 'price_cents'
> & {
    coverPhotoUrl: string | null
    owner: {
        username: string
        profilePictureUrl: string | null
    }
}

export function ListingBrowseCard({ listing }: { listing: ListingBrowseCardData }) {
    const sharingLabels = listing.transaction_types.map((type) =>
        type === 'sell' && listing.price_cents !== null
            ? formatListingPrice(listing.price_cents)
            : LISTING_TRANSACTION_TYPE_LABELS[type],
    )

    return (
        <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
            <div className="relative aspect-square overflow-hidden bg-secondary">
                {listing.coverPhotoUrl ? (
                    <Image
                        src={listing.coverPhotoUrl}
                        alt={listing.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                        className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                ) : (
                    <ListingPhotoPlaceholder
                        category={listing.category}
                        title={listing.title}
                    />
                )}
            </div>

            <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h2 className="line-clamp-2 font-semibold leading-5 text-foreground">
                    {listing.title}
                </h2>
                <p className="mt-1 break-words text-sm font-semibold text-primary">
                    {sharingLabels.join(' · ')}
                </p>

                <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
                    <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                        {listing.owner.profilePictureUrl ? (
                            <Image
                                src={listing.owner.profilePictureUrl}
                                alt=""
                                fill
                                sizes="24px"
                                className="object-cover"
                            />
                        ) : (
                            <UserRound className="size-3.5" aria-hidden="true" />
                        )}
                    </span>
                    <span className="truncate">@{listing.owner.username}</span>
                </div>
            </div>
        </article>
    )
}
