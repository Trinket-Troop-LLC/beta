import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import { PhotoCarousel } from '@/components/listings/photo-carousel'
import { TransactionTypePill } from '@/components/listings/transaction-type-pill'
import { LabeledField } from '@/components/listings/labeled-field'
import {
    LISTING_CATEGORY_LABELS,
    LISTING_CONDITION_LABELS,
    LISTING_STATUS_LABELS,
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
        .select('id, owner_id, title, description, category, other_category, condition, transaction_types, price_cents, pickup_area, nuance, status, published_at')
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


    const categoryLabel = listing.category === 'other'
        ? listing.other_category ?? LISTING_CATEGORY_LABELS.other
        : LISTING_CATEGORY_LABELS[listing.category as keyof typeof LISTING_CATEGORY_LABELS]

    return (
        <div className="mx-auto w-full max-w-2xl text-left">
            <PhotoCarousel photoUrls={photoUrls} title={listing.title} />

            <div className="mt-5">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-2xl font-semibold text-foreground">{listing.title}</h1>
                    {(listing.status !== 'active' || isOwner) && (
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                            {LISTING_STATUS_LABELS[listing.status as keyof typeof LISTING_STATUS_LABELS]}
                        </span>
                    )}
                </div>

                <div className="mt-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Open for
                    </h2>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {listing.transaction_types.map((type: ListingTransactionType) => (
                            <TransactionTypePill key={type} type={type} isOwner={isOwner} />
                        ))}
                    </div>
                </div>

                {listing.transaction_types.includes('sell') && listing.price_cents !== null && (
                    <div className="mt-3">
                        <LabeledField label="price" value={formatListingPrice(listing.price_cents)} />
                    </div>
                )}

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

                {listing.nuance && (
                    <div className="mt-6">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Nuance box
                        </h2>
                        <p className="mt-2 whitespace-pre-wrap text-foreground">
                            {listing.nuance}
                        </p>
                    </div>
                )}

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
        <main className="relative flex-1 px-8 py-10 pb-44">
            <Suspense fallback={null}>
                <ListingDetailContent listingId={id} />
            </Suspense>
        </main>
    )
}
