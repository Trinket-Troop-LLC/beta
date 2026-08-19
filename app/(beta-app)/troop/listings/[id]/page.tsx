import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowLeft, UserRound } from 'lucide-react'
import { z } from 'zod'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { ListingPhotoPlaceholder } from '@/components/listings/listing-photo-placeholder'
import { Button } from '@/components/ui/button'
import {
    LISTING_CATEGORY_LABELS,
    LISTING_CONDITION_LABELS,
    LISTING_STATUS_LABELS,
    LISTING_TRANSACTION_TYPE_LABELS,
    formatListingPrice,
    type Listing,
} from '@/lib/listings/domain'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import { requireMember } from '@/lib/supabase/require-member'

type ListingDetail = Pick<
    Listing,
    | 'id'
    | 'owner_id'
    | 'title'
    | 'description'
    | 'category'
    | 'other_category'
    | 'condition'
    | 'transaction_types'
    | 'price_cents'
    | 'pickup_area'
    | 'status'
    | 'published_at'
>

function getProfilePicturePath(responses: unknown) {
    if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
        return null
    }

    const path = (responses as Record<string, unknown>).profile_picture_path
    return typeof path === 'string' && path.length > 0 ? path : null
}

async function ListingDetailContent({ listingId }: { listingId: string }) {
    const { db, user } = await requireMember()
    const { data: listingRow, error: listingError } = await db
        .from('listings')
        .select('id, owner_id, title, description, category, other_category, condition, transaction_types, price_cents, pickup_area, status, published_at')
        .eq('id', listingId)
        .in('status', ['active', 'reserved'])
        .maybeSingle()

    if (listingError) {
        console.warn('Listing detail query failed:', listingError.code)
        return (
            <div className="mx-auto w-full max-w-2xl">
                <Link
                    href="/troop"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back to Home
                </Link>
                <p
                    className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4 text-sm text-destructive"
                    role="alert"
                >
                    We could not load this listing right now. Go back and try again.
                </p>
            </div>
        )
    }

    if (!listingRow) {
        notFound()
    }

    const listing = listingRow as ListingDetail
    const [photoResult, ownerResult] = await Promise.all([
        db
            .from('listing_photos')
            .select('storage_path')
            .eq('listing_id', listing.id)
            .order('position', { ascending: true }),
        db
            .from('users')
            .select('id, username, preferred_name, first_name, responses')
            .eq('id', listing.owner_id)
            .maybeSingle(),
    ])

    if (photoResult.error) {
        console.warn('Listing detail photo query failed:', photoResult.error.code)
    }
    if (ownerResult.error) {
        console.warn('Listing detail owner query failed:', ownerResult.error.code)
    }

    const photoPaths = photoResult.data?.map((photo) => photo.storage_path) ?? []
    const ownerPicturePath = getProfilePicturePath(ownerResult.data?.responses)
    const [signedPhotoResult, ownerPictureUrl] = await Promise.all([
        photoPaths.length > 0
            ? db.storage.from('listing-photos').createSignedUrls(photoPaths, 3600)
            : Promise.resolve({ data: [], error: null }),
        signProfilePictureUrl(db, ownerPicturePath),
    ])

    if (signedPhotoResult.error) {
        console.warn(
            'Listing detail photo signing failed:',
            signedPhotoResult.error.statusCode,
        )
    }

    const hasUnsignedPhoto = signedPhotoResult.data?.some(
        (photo) => photo.error || !photo.signedUrl,
    ) ?? false
    const hasPhotoLoadError = Boolean(
        photoResult.error || signedPhotoResult.error || hasUnsignedPhoto,
    )
    const signedUrlByPath = new Map(
        signedPhotoResult.data
            ?.filter((photo) => !photo.error && Boolean(photo.signedUrl))
            .map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )
    const photoUrls = photoPaths
        .map((path) => signedUrlByPath.get(path))
        .filter((url): url is string => Boolean(url))
    const sharingLabels = listing.transaction_types.map((type) =>
        type === 'sell' && listing.price_cents !== null
            ? formatListingPrice(listing.price_cents)
            : LISTING_TRANSACTION_TYPE_LABELS[type],
    )
    const categoryLabel = listing.category === 'other'
        ? listing.other_category ?? LISTING_CATEGORY_LABELS.other
        : LISTING_CATEGORY_LABELS[listing.category]
    const ownerUsername = ownerResult.data?.username ?? 'troop-member'
    const ownerDisplayName = ownerResult.data?.preferred_name
        || ownerResult.data?.first_name
        || ownerUsername
    const isOwner = listing.owner_id === user.id

    return (
        <article className="mx-auto w-full max-w-2xl">
            <Link
                href="/troop"
                className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to Home
            </Link>

            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-3xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photoUrls.length > 0 ? (
                    photoUrls.map((url, index) => (
                        <div
                            key={url}
                            className="relative aspect-square w-full flex-none snap-center overflow-hidden rounded-3xl border border-border bg-secondary"
                        >
                            <Image
                                src={url}
                                alt={`${listing.title}, photo ${index + 1}`}
                                fill
                                sizes="(max-width: 768px) 100vw, 672px"
                                className="object-cover"
                                priority={index === 0}
                            />
                        </div>
                    ))
                ) : (
                    <div className="aspect-square w-full flex-none overflow-hidden rounded-3xl border border-border bg-secondary">
                        <ListingPhotoPlaceholder
                            category={listing.category}
                            title={listing.title}
                        />
                    </div>
                )}
            </div>
            {hasPhotoLoadError && (
                <p
                    className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
                    role="status"
                >
                    Some listing photos are unavailable right now. A placeholder is shown where needed.
                </p>
            )}

            <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
                            {listing.title}
                        </h1>
                        <p className="mt-2 text-lg font-semibold text-primary">
                            {sharingLabels.join(' · ')}
                        </p>
                    </div>
                    {listing.status !== 'active' && (
                        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                            {LISTING_STATUS_LABELS[listing.status]}
                        </span>
                    )}
                </div>

                {listing.status === 'reserved' && (
                    <p className="mt-5 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                        This trinket is currently reserved and is not available for a new exchange.
                    </p>
                )}

                {!isOwner && listing.status === 'active' && (
                    <Button asChild className="mt-5 w-full">
                        <Link href={`/troop/listings/${listing.id}/offer`}>
                            Make an offer
                        </Link>
                    </Button>
                )}

                <section className="mt-7">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        About this trinket
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground">
                        {listing.description}
                    </p>
                </section>

                <section className="mt-7 border-t border-border pt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Details
                    </h2>
                    <dl className="mt-3 space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Category</dt>
                            <dd className="text-right font-medium text-foreground">{categoryLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Condition</dt>
                            <dd className="text-right font-medium text-foreground">
                                {LISTING_CONDITION_LABELS[listing.condition]}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Pickup area</dt>
                            <dd className="text-right font-medium text-foreground">
                                {listing.pickup_area}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section className="mt-7 flex items-center gap-3 border-t border-border pt-6">
                    <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-muted-foreground">
                        {ownerPictureUrl ? (
                            <Image
                                src={ownerPictureUrl}
                                alt={`${ownerUsername}'s profile picture`}
                                fill
                                sizes="48px"
                                className="object-cover"
                            />
                        ) : (
                            <UserRound className="size-6" aria-hidden="true" />
                        )}
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Listed by</p>
                        <p className="truncate font-semibold text-foreground">
                            {isOwner ? 'You' : ownerDisplayName}
                        </p>
                        {!isOwner && (
                            <p className="truncate text-sm text-muted-foreground">
                                @{ownerUsername}
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </article>
    )
}

function ListingDetailSkeleton() {
    return (
        <div className="mx-auto w-full max-w-2xl animate-pulse" aria-hidden="true">
            <div className="mb-5 h-5 w-28 rounded bg-secondary" />
            <div className="aspect-square rounded-3xl bg-secondary" />
            <div className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-6">
                <div className="h-8 w-3/4 rounded bg-secondary" />
                <div className="h-5 w-1/3 rounded bg-secondary" />
                <div className="h-24 rounded bg-secondary" />
            </div>
        </div>
    )
}

export default async function ListingDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    if (!z.string().uuid().safeParse(id).success) {
        notFound()
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8 pb-48 sm:px-6 sm:py-10">
            <Suspense fallback={<ListingDetailSkeleton />}>
                <ListingDetailContent listingId={id} />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}
