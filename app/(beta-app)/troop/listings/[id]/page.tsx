import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ImageIcon, UserRound } from 'lucide-react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import {
    LISTING_CATEGORY_LABELS,
    LISTING_CONDITION_LABELS,
    LISTING_STATUS_LABELS,
    LISTING_TRANSACTION_TYPE_LABELS,
    formatListingPrice,
    type ListingTransactionType,
} from '@/lib/listings/domain'
import { ExchangeActions } from './exchange-actions'
import { OfferReview } from './offer-review'
import { getPendingOffersForListing } from '../../listing-lifecycle-actions'

function OwnerCard({
    isOwner,
    ownerUsername,
    pictureUrl,
    displayName,
}: {
    isOwner: boolean
    ownerUsername: string | null
    pictureUrl: string | null
    displayName: string
}) {
    const content = (
        <>
            {pictureUrl ? (
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-secondary">
                    <Image src={pictureUrl} alt={displayName} fill className="object-cover" />
                </div>
            ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <UserRound className="size-6" />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Listed by</p>
                <p className="truncate font-medium text-foreground">{isOwner ? 'You' : displayName}</p>
            </div>
        </>
    )

    if (isOwner || !ownerUsername) {
        return <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border p-4">{content}</div>
    }

    return (
        <Link
            href={`/profile/${encodeURIComponent(ownerUsername)}`}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-border p-4 transition hover:bg-secondary/50"
        >
            {content}
        </Link>
    )
}

async function ListingDetailContent({ listingId }: { listingId: string }) {
    const { db, user } = await requireMember()

    const { data: listing } = await db
        .from('listings')
        .select('id, owner_id, title, description, category, other_category, condition, transaction_types, price_cents, pickup_area, status, published_at')
        .eq('id', listingId)
        .maybeSingle()

    if (!listing) {
        notFound()
    }

    const { data: photoRows } = await db
        .from('listing_photos')
        .select('storage_path')
        .eq('listing_id', listing.id)
        .order('position', { ascending: true })

    const photoPaths = photoRows?.map((photo) => photo.storage_path) ?? []
    const { data: signedPhotos } = photoPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(photoPaths, 3600)
        : { data: [] }

    const signedUrlByPath = new Map(
        signedPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )
    const photoUrls = photoPaths
        .map((path) => signedUrlByPath.get(path))
        .filter((url): url is string => Boolean(url))

    const { data: owner } = await db
        .from('users')
        .select('id, username, preferred_name, first_name, responses')
        .eq('id', listing.owner_id)
        .maybeSingle()

    const ownerPictureUrl = await signProfilePictureUrl(db, owner?.responses?.profile_picture_path)
    const ownerDisplayName = owner?.preferred_name || owner?.first_name || owner?.username || 'A troop member'
    const isOwner = listing.owner_id === user.id

    const pendingOffers = isOwner && listing.status === 'active'
        ? await getPendingOffersForListing(listing.id)
        : null


    const sharingLabels = listing.transaction_types.map((type: string) =>
        type === 'sell' && listing.price_cents !== null
            ? formatListingPrice(listing.price_cents)
            : LISTING_TRANSACTION_TYPE_LABELS[type as keyof typeof LISTING_TRANSACTION_TYPE_LABELS],
    )
    const categoryLabel = listing.category === 'other'
        ? listing.other_category ?? LISTING_CATEGORY_LABELS.other
        : LISTING_CATEGORY_LABELS[listing.category as keyof typeof LISTING_CATEGORY_LABELS]

    return (
        <div className="mx-auto w-full max-w-2xl text-left">
            <div className="flex gap-2 overflow-x-auto rounded-2xl snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photoUrls.length > 0 ? (
                    photoUrls.map((url, index) => (
                        <div
                            key={url}
                            className="relative aspect-square w-full flex-none snap-center overflow-hidden rounded-2xl bg-secondary"
                        >
                            <Image
                                src={url}
                                alt={`${listing.title} photo ${index + 1}`}
                                fill
                                sizes="(max-width: 640px) 100vw, 640px"
                                className="object-cover"
                                priority={index === 0}
                            />
                        </div>
                    ))
                ) : (
                    <div className="flex aspect-square w-full flex-none items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                        <ImageIcon className="size-12" />
                    </div>
                )}
            </div>

            <div className="mt-5">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-2xl font-semibold text-foreground">{listing.title}</h1>
                    {(listing.status !== 'active' || isOwner) && (
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                            {LISTING_STATUS_LABELS[listing.status as keyof typeof LISTING_STATUS_LABELS]}
                        </span>
                    )}
                </div>

                <span className="mt-1 block text-lg font-semibold text-primary">
                    {sharingLabels.join(' · ')}
                </span>

                {!isOwner && (
                    listing.status === 'active' ? (
                        <ExchangeActions
                            listingId={listing.id}
                            listingTitle={listing.title}
                            ownerId={listing.owner_id}
                            transactionTypes={listing.transaction_types as ListingTransactionType[]}
                            priceCents={listing.price_cents}
                        />
                    ) : (
                        <p className="mt-6 text-sm text-muted-foreground">
                            This listing is {LISTING_STATUS_LABELS[listing.status as keyof typeof LISTING_STATUS_LABELS]} and isn&apos;t available right now.
                        </p>
                    )
                )}

                {pendingOffers?.success && <OfferReview offers={pendingOffers.offers} />}

                <div className="mt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Description
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-foreground">
                        {listing.description}
                    </p>
                </div>

                <div className="mt-6 rounded-2xl border border-border p-4">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Details
                    </h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Category</dt>
                            <dd className="text-right font-medium text-foreground">{categoryLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Condition</dt>
                            <dd className="text-right font-medium text-foreground">
                                {LISTING_CONDITION_LABELS[listing.condition as keyof typeof LISTING_CONDITION_LABELS]}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Pickup area</dt>
                            <dd className="text-right font-medium text-foreground">{listing.pickup_area}</dd>
                        </div>
                    </dl>
                </div>

                <OwnerCard
                    isOwner={isOwner}
                    ownerUsername={owner?.username ?? null}
                    pictureUrl={ownerPictureUrl}
                    displayName={ownerDisplayName}
                />
            </div>
        </div>
    )
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    return (
        <main className="relative min-h-screen bg-[#faf7f0] px-4 py-10 pb-32">
            <Suspense fallback={null}>
                <ListingDetailContent listingId={id} />
            </Suspense>
        </main>
    )
}
