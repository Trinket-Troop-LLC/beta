import 'server-only'

import type { ListingBrowseCardData } from '@/components/listings/listing-browse-card'
import type {
    ListingCategory,
    ListingStatus,
    ListingTransactionType,
} from '@/lib/listings/domain'
import type { createClient } from '@/lib/supabase/server'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'

type Db = Awaited<ReturnType<typeof createClient>>

export const LISTING_FEED_PAGE_SIZE = 20

export type ListingFeedCursor = {
    publishedAt: string
    id: string
}

export type ListingFeedResult =
    | {
        success: true
        listings: ListingBrowseCardData[]
        nextCursor: ListingFeedCursor | null
        hasPartialMediaError: boolean
    }
    | { success: false; error: string }

function getProfilePicturePath(responses: unknown) {
    if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
        return null
    }

    const path = (responses as Record<string, unknown>).profile_picture_path
    return typeof path === 'string' && path.length > 0 ? path : null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

export function normalizeListingFeedCursor(value: unknown): ListingFeedCursor | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }

    const cursor = value as Record<string, unknown>
    if (
        typeof cursor.publishedAt !== 'string'
        || !timestampPattern.test(cursor.publishedAt)
        || typeof cursor.id !== 'string'
        || !uuidPattern.test(cursor.id)
    ) {
        return null
    }

    const timestamp = Date.parse(cursor.publishedAt)
    if (!Number.isFinite(timestamp)) {
        return null
    }

    return {
        publishedAt: cursor.publishedAt,
        id: cursor.id,
    }
}

export async function getListingFeedPage(
    db: Db,
    cursor: ListingFeedCursor | null,
): Promise<ListingFeedResult> {
    let listingsQuery = db
        .from('listings')
        .select('id, owner_id, title, category, transaction_types, price_cents, status, published_at')
        .in('status', ['active', 'reserved'])
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(LISTING_FEED_PAGE_SIZE + 1)

    if (cursor) {
        listingsQuery = listingsQuery.or(
            `published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`,
        )
    }

    const { data: rows, error: listingsError } = await listingsQuery

    if (listingsError) {
        console.warn('Troop listings query failed:', listingsError.code)
        return {
            success: false,
            error: 'We could not load the troop shelf right now. Refresh and try again.',
        }
    }

    const pageRows = (rows ?? []).slice(0, LISTING_FEED_PAGE_SIZE)
    const hasMore = (rows?.length ?? 0) > LISTING_FEED_PAGE_SIZE
    const lastRow = pageRows.at(-1)
    const nextCursor = hasMore && lastRow?.published_at
        ? {
            publishedAt: lastRow.published_at,
            id: lastRow.id,
        }
        : null

    if (pageRows.length === 0) {
        return {
            success: true,
            listings: [],
            nextCursor: null,
            hasPartialMediaError: false,
        }
    }

    const listingIds = pageRows.map((listing) => listing.id)
    const ownerIds = [...new Set(pageRows.map((listing) => listing.owner_id))]
    const [coverResult, ownerResult] = await Promise.all([
        db
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', listingIds)
            .eq('position', 0),
        db
            .from('users')
            .select('id, username, responses')
            .in('id', ownerIds),
    ])

    if (coverResult.error) {
        console.warn('Troop listing cover query failed:', coverResult.error.code)
    }
    if (ownerResult.error) {
        console.warn('Troop listing owner query failed:', ownerResult.error.code)
    }

    const coverPaths = coverResult.data?.map((photo) => photo.storage_path) ?? []
    const profilePaths = ownerResult.data?.map(
        (owner) => getProfilePicturePath(owner.responses),
    ) ?? []
    const [signedCoverResult, signedProfileUrls] = await Promise.all([
        coverPaths.length > 0
            ? db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
            : Promise.resolve({ data: [], error: null }),
        signProfilePictureUrls(db, profilePaths),
    ])

    if (signedCoverResult.error) {
        console.warn(
            'Troop listing cover signing failed:',
            signedCoverResult.error.statusCode,
        )
    }

    const hasUnsignedCover = signedCoverResult.data?.some(
        (photo) => photo.error || !photo.signedUrl,
    ) ?? false
    const coverPathByListingId = new Map(
        coverResult.data?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedCoverUrlByPath = new Map(
        signedCoverResult.data
            ?.filter((photo) => !photo.error && Boolean(photo.signedUrl))
            .map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )
    const ownerById = new Map(ownerResult.data?.map((owner) => [owner.id, owner]) ?? [])

    const listings: ListingBrowseCardData[] = pageRows.map((row) => {
        const coverPath = coverPathByListingId.get(row.id)
        const owner = ownerById.get(row.owner_id)
        const profilePath = getProfilePicturePath(owner?.responses)

        return {
            id: row.id,
            owner_id: row.owner_id,
            title: row.title,
            category: row.category as ListingCategory,
            transaction_types: row.transaction_types as ListingTransactionType[],
            price_cents: row.price_cents,
            status: row.status as ListingStatus,
            coverPhotoUrl: coverPath
                ? signedCoverUrlByPath.get(coverPath) ?? null
                : null,
            owner: {
                username: owner?.username ?? 'troop-member',
                profilePictureUrl: profilePath
                    ? signedProfileUrls.get(profilePath) ?? null
                    : null,
            },
        }
    })

    return {
        success: true,
        listings,
        nextCursor,
        hasPartialMediaError: Boolean(
            coverResult.error
            || ownerResult.error
            || signedCoverResult.error
            || hasUnsignedCover,
        ),
    }
}
