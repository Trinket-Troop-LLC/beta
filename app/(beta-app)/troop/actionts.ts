'use server'

import { createClient } from '@/lib/supabase/server'
import type { ListingBrowseCardData } from '@/components/listings/listing-browse-card'

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

const PAGE_SIZE = 20

export type ListingFeedCursor = {
    publishedAt: string
    id: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

// A tampered or stale cursor shouldn't reach the query -- an invalid id in
// particular would make postgres error on the uuid comparison below rather
// than just returning an empty/odd page.
function isValidCursor(cursor: unknown): cursor is ListingFeedCursor {
    if (!cursor || typeof cursor !== 'object') return false
    const { publishedAt, id } = cursor as Record<string, unknown>
    return typeof publishedAt === 'string' && timestampPattern.test(publishedAt)
        && typeof id === 'string' && uuidPattern.test(id)
}

type GetListingsViewResult =
    | { success: true; listings: ListingBrowseCardData[]; nextCursor: ListingFeedCursor | null }
    | { success: false; error: string }

// Keyset (cursor) pagination: each page is fetched relative to the last row
// actually seen (published_at, id), not a row count. That keeps results
// stable even if a listing is posted while someone's paging through (an
// offset/range query can skip or repeat a row when that happens), and lets
// postgres seek directly to that point instead of walking past everything
// before the offset on every request.
export async function getListingsView(cursor: unknown = null): Promise<GetListingsViewResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to view listings' }

    const safeCursor = isValidCursor(cursor) ? cursor : null

    let query = db
        .from('listings')
        .select('id, title, transaction_types, price_cents, status, published_at')
        .in('status', ['active', 'reserved'])
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1)

    if (safeCursor) {
        query = query.or(
            `published_at.lt.${safeCursor.publishedAt},and(published_at.eq.${safeCursor.publishedAt},id.lt.${safeCursor.id})`,
        )
    }

    const { data: rows, error: listingsError } = await query

    if (listingsError) {
        console.warn('Troop listings query failed:', listingsError.code)
        return { success: false, error: 'Could not load listings. Please try again.' }
    }

    // One extra row was requested above so its presence can answer "is there
    // a next page" without a separate count query; trim it back off here.
    const pageRows = (rows ?? []).slice(0, PAGE_SIZE)
    const hasMore = (rows?.length ?? 0) > PAGE_SIZE
    const lastRow = pageRows.at(-1)
    const nextCursor = hasMore && lastRow
        ? { publishedAt: lastRow.published_at, id: lastRow.id }
        : null

    // finding the cover photo for each listing
    const listingIds = pageRows.map((listing) => listing.id)
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

    const listings: ListingBrowseCardData[] = pageRows.map((listing) => {
        const coverPath = coverPathByListingId.get(listing.id)

        return {
            id: listing.id,
            title: listing.title,
            transaction_types: listing.transaction_types,
            price_cents: listing.price_cents,
            status: listing.status,
            coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
        }
    })

    return { success: true, listings, nextCursor }
}
