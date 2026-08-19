import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { LISTING_CATEGORY_LABELS, type ListingCategory } from '@/lib/listings/domain'
import { requireMember } from '@/lib/supabase/require-member'
import { OfferForm, type OwnListingOption } from './offer-form'

async function OfferContent({ listingId }: { listingId: string }) {
    const { db, user } = await requireMember()

    const { data: targetListing, error: targetListingError } = await db
        .from('listings')
        .select('id, title, owner_id, status')
        .eq('id', listingId)
        .maybeSingle()

    if (targetListingError) {
        return (
            <div className="mx-auto w-full max-w-2xl">
                <p
                    className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4 text-sm text-destructive"
                    role="alert"
                >
                    We could not load this listing right now. Go back and try again.
                </p>
            </div>
        )
    }

    if (!targetListing) {
        notFound()
    }

    if (targetListing.owner_id === user.id || targetListing.status !== 'active') {
        redirect(`/troop/listings/${listingId}`)
    }

    const { data: ownListingRows } = await db
        .from('listings')
        .select('id, title, category')
        .eq('owner_id', user.id)
        .eq('status', 'active')
        .order('published_at', { ascending: false })

    const ownListingIds = ownListingRows?.map((listing) => listing.id) ?? []
    const { data: coverPhotos } = ownListingIds.length > 0
        ? await db
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', ownListingIds)
            .eq('position', 0)
        : { data: [] }

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedCoverPhotos } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] }
    const signedUrlByPath = new Map(
        signedCoverPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const ownListings: OwnListingOption[] = (
        ownListingRows as { id: string; title: string; category: ListingCategory }[] | null ?? []
    ).map((listing) => {
        const coverPath = coverPathByListingId.get(listing.id)

        return {
            id: listing.id,
            title: listing.title,
            categoryLabel: LISTING_CATEGORY_LABELS[listing.category],
            category: listing.category,
            coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
        }
    })

    return (
        <div className="mx-auto w-full max-w-2xl">
            <Link
                href={`/troop/listings/${listingId}`}
                className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to listing
            </Link>

            <h1 className="text-2xl font-semibold text-foreground">
                Make an offer on &ldquo;{targetListing.title}&rdquo;
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
                Offer one of your own listings in trade, write a message, or both. If you don&apos;t
                choose one of your own listings, a message is required.
            </p>

            <div className="mt-6">
                <OfferForm listingId={listingId} ownListings={ownListings} />
            </div>
        </div>
    )
}

export default async function ListingOfferPage({
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
            <Suspense fallback={null}>
                <OfferContent listingId={id} />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}
