'use server'

import { createClient } from '@/lib/supabase/server'
import type { ListingBrowseCardData } from '@/components/listings/listing-browse-card'

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

const PAGE_SIZE = 20

type GetListingsViewResult =
    | { success: true; listings: ListingBrowseCardData[]; hasMore: boolean }
    | { success: false; error: string }

export async function getListingsView(page = 0): Promise<GetListingsViewResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to view listings' }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data: listingRows, error: listingsError } = await db
        .from('listings')
        .select('id, title, transaction_types, price_cents')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .range(from, to)

    if (listingsError) {
        console.warn('Troop listings query failed:', listingsError.code)
        return { success: false, error: 'Could not load listings. Please try again.' }
    }

    // finding the cover photo for each listing
    const listingIds = (listingRows ?? []).map((listing) => listing.id)
    const { data: coverPhotos, error: coverPhotosError } = listingIds.length > 0
        ? await db
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', listingIds)
            .eq('position', 0)
        : { data: [], error: null }

    if (coverPhotosError) {
        console.warn('Listing cover query failed:', coverPhotosError.code)
    }

    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedCoverPhotos, error: signedCoverPhotosError } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [], error: null }

    if (signedCoverPhotosError) {
        console.warn('Listing cover signing failed:', signedCoverPhotosError.statusCode)
    }

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedUrlByPath = new Map(
        signedCoverPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const listings: ListingBrowseCardData[] = (listingRows ?? [] ).map((listing) => {
        const coverPath = coverPathByListingId.get(listing.id)

        return {
            ...listing,
            coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
        }
    })

    return { success: true, listings, hasMore: listingRows.length === PAGE_SIZE }
}