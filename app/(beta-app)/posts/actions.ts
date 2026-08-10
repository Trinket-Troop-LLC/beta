'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
    LISTING_CATEGORIES,
    LISTING_CONDITIONS,
    LISTING_TRANSACTION_TYPES,
} from '@/lib/listings/domain'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
    getJpegDimensions,
    getVerifiedImageExtension,
} from '@/lib/validate-image'

const listingPhotosBucket = 'listing-photos'
const maxListingPhotoBytes = 5 * 1024 * 1024
const maxListingPhotoDimension = 4096
const maxListingPhotoPixels = 16_000_000
const maxPostgresInteger = 2_147_483_647
const listingPhotoNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/

type FieldErrors = Record<string, string>

export type CreateListingDraftResult =
    | { success: true; listingId: string; photoPaths: string[] }
    | { success: false; error?: string; fieldErrors?: FieldErrors }

export type ListingActionResult =
    | { success: true }
    | { success: false; error: string }

export type DiscardListingDraftResult =
    | { success: true; state: 'discarded' | 'published' }
    | { success: false; error: string }

const listingDraftSchema = z
    .object({
        title: z.string().trim().min(1, 'Title is required').max(120),
        description: z.string().trim().min(1, 'Description is required').max(3000),
        category: z.enum(LISTING_CATEGORIES),
        other_category: z.string().trim().max(100),
        condition: z.enum(LISTING_CONDITIONS),
        transaction_types: z
            .array(z.enum(LISTING_TRANSACTION_TYPES))
            .min(1, 'Choose at least one way to share this item')
            .max(3)
            .transform((types) => [...new Set(types)]),
        price: z.string().trim().max(20),
        pickup_area: z.string().trim().min(1, 'Pickup area is required').max(150),
    })
    .superRefine((listing, context) => {
        if (listing.category === 'other' && !listing.other_category) {
            context.addIssue({
                code: 'custom',
                message: 'Please describe the other category',
                path: ['other_category'],
            })
        }

        const isForSale = listing.transaction_types.includes('sell')
        const priceCents = parsePriceCents(listing.price)

        if (isForSale) {
            if (priceCents === null) {
                context.addIssue({
                    code: 'custom',
                    message: 'Enter a price with no more than two decimal places',
                    path: ['price'],
                })
            } else if (priceCents <= 0 || priceCents > maxPostgresInteger) {
                context.addIssue({
                    code: 'custom',
                    message: 'Enter a valid price greater than $0',
                    path: ['price'],
                })
            }
        } else if (listing.price) {
            context.addIssue({
                code: 'custom',
                message: 'Only add a price when selling the item',
                path: ['price'],
            })
        }
    })

function getText(formData: FormData, name: string) {
    const value = formData.get(name)
    return typeof value === 'string' ? value : ''
}

function buildFieldErrors(error: z.ZodError): FieldErrors {
    const fieldErrors: FieldErrors = {}

    for (const issue of error.issues) {
        const field = issue.path[0]?.toString()
        if (field && !fieldErrors[field]) {
            fieldErrors[field] = issue.message
        }
    }

    return fieldErrors
}

function parsePriceCents(value: string): number | null {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())

    if (!match) {
        return null
    }

    const dollars = Number(match[1])
    const cents = Number((match[2] ?? '').padEnd(2, '0'))
    const total = dollars * 100 + cents

    return Number.isSafeInteger(total) ? total : null
}

async function getMemberContext() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { db, user: null }
    }

    const { data: profile } = await db
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

    return { db, user: profile ? user : null }
}

function createReservedPhotoPaths(userId: string, listingId: string, photoCount: number) {
    return Array.from(
        { length: photoCount },
        () => `${userId}/${listingId}/${crypto.randomUUID()}.jpg`,
    )
}

function hasValidReservations(
    userId: string,
    listingId: string,
    reservations: Array<{ position: number; storage_path: string }>,
) {
    const expectedPrefix = `${userId}/${listingId}/`

    return reservations.length >= 1
        && reservations.length <= 5
        && reservations.every((reservation, index) => {
            const name = reservation.storage_path.slice(expectedPrefix.length)
            return reservation.position === index
                && reservation.storage_path.startsWith(expectedPrefix)
                && listingPhotoNamePattern.test(name)
        })
        && new Set(reservations.map((reservation) => reservation.storage_path)).size
            === reservations.length
}

async function listStoredPhotoPaths(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
) {
    const prefix = `${userId}/${listingId}`
    const { data, error } = await admin.storage
        .from(listingPhotosBucket)
        .list(prefix, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })

    if (error) {
        console.error('Listing photo enumeration failed:', error.statusCode)
        return { paths: null, error: true } as const
    }

    const paths = (data ?? [])
        .filter((item) => Boolean(item.id))
        .map((item) => `${prefix}/${item.name}`)

    const hasUnexpectedEntries = (data ?? []).some(
        (item) => !item.id || !listingPhotoNamePattern.test(item.name),
    )

    return { paths, hasUnexpectedEntries, error: false } as const
}

function haveSamePaths(first: string[], second: string[]) {
    return first.length === second.length
        && first.every((path) => second.includes(path))
}

async function removeAllStoredPhotos(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
) {
    // The archived tombstone blocks new uploads and gives a later retry/sweep
    // an authorization anchor if an in-flight upload lands just after this
    // bounded cleanup pass.
    for (let pass = 0; pass < 3; pass += 1) {
        const stored = await listStoredPhotoPaths(admin, userId, listingId)

        if (stored.error) {
            return false
        }

        if (stored.paths.length === 0) {
            return !stored.hasUnexpectedEntries
        }

        const { error } = await admin.storage.from(listingPhotosBucket).remove(stored.paths)

        if (error) {
            console.error('Listing photo cleanup failed:', error.statusCode)
            return false
        }
    }

    const remaining = await listStoredPhotoPaths(admin, userId, listingId)
    return !remaining.error
        && !remaining.hasUnexpectedEntries
        && remaining.paths.length === 0
}

async function sweepAbandonedListingTombstones(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
) {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: tombstones, error } = await admin
        .from('listings')
        .select('id')
        .eq('owner_id', userId)
        .eq('status', 'archived')
        .is('published_at', null)
        .lt('updated_at', cutoff)
        .limit(20)

    if (error) {
        console.error('Listing tombstone sweep query failed:', error.code)
        return
    }

    for (const tombstone of tombstones ?? []) {
        const photosRemoved = await removeAllStoredPhotos(admin, userId, tombstone.id)

        if (!photosRemoved) {
            continue
        }

        const { error: deleteError } = await admin
            .from('listings')
            .delete()
            .eq('id', tombstone.id)
            .eq('owner_id', userId)
            .eq('status', 'archived')
            .is('published_at', null)

        if (deleteError) {
            console.error('Listing tombstone sweep delete failed:', deleteError.code)
        }
    }
}

export async function createListingDraft(
    formData: FormData,
    photoCount: unknown,
): Promise<CreateListingDraftResult> {
    if (!(formData instanceof FormData)) {
        return { success: false, error: 'The post form was not valid.' }
    }

    const { user } = await getMemberContext()

    if (!user) {
        return { success: false, error: 'You must be an approved member to make a post.' }
    }

    const photoCountResult = z.number().int().min(1).max(5).safeParse(photoCount)

    if (!photoCountResult.success) {
        return { success: false, fieldErrors: { photos: 'Choose between 1 and 5 photos.' } }
    }

    const validationFields = listingDraftSchema.safeParse({
        title: getText(formData, 'title'),
        description: getText(formData, 'description'),
        category: getText(formData, 'category'),
        other_category: getText(formData, 'other_category'),
        condition: getText(formData, 'condition'),
        transaction_types: formData
            .getAll('transaction_types')
            .filter((type): type is string => typeof type === 'string'),
        price: getText(formData, 'price'),
        pickup_area: getText(formData, 'pickup_area'),
    })

    if (!validationFields.success) {
        return {
            success: false,
            fieldErrors: buildFieldErrors(validationFields.error),
        }
    }

    const listing = validationFields.data
    const listingId = crypto.randomUUID()
    const photoPaths = createReservedPhotoPaths(user.id, listingId, photoCountResult.data)
    const isForSale = listing.transaction_types.includes('sell')
    const admin = createAdminClient()

    await sweepAbandonedListingTombstones(admin, user.id)

    const { error: listingError } = await admin.from('listings').insert({
        id: listingId,
        owner_id: user.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        other_category: listing.category === 'other' ? listing.other_category : null,
        condition: listing.condition,
        transaction_types: listing.transaction_types,
        price_cents: isForSale ? parsePriceCents(listing.price) : null,
        pickup_area: listing.pickup_area,
        status: 'draft',
    })

    if (listingError) {
        console.error('Listing draft creation failed:', listingError.code)
        return {
            success: false,
            error: 'We could not start this post right now. Please try again.',
        }
    }

    const { error: reservationError } = await admin.from('listing_photos').insert(
        photoPaths.map((storagePath, position) => ({
            listing_id: listingId,
            storage_path: storagePath,
            position,
        })),
    )

    if (reservationError) {
        console.error('Listing photo reservation failed:', reservationError.code)
        await admin
            .from('listings')
            .delete()
            .eq('id', listingId)
            .eq('owner_id', user.id)
            .eq('status', 'draft')

        return {
            success: false,
            error: 'We could not prepare the photos for this post. Please try again.',
        }
    }

    return { success: true, listingId, photoPaths }
}

export async function finalizeListing(listingId: unknown): Promise<ListingActionResult> {
    const idValidation = z.string().uuid().safeParse(listingId)

    if (!idValidation.success) {
        return { success: false, error: 'The listing was not valid.' }
    }

    const { user } = await getMemberContext()

    if (!user) {
        return { success: false, error: 'You must be an approved member to publish a post.' }
    }

    const admin = createAdminClient()
    const { data: listing, error: listingError } = await admin
        .from('listings')
        .select('id, status')
        .eq('id', idValidation.data)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (listingError || !listing) {
        return { success: false, error: 'This draft is no longer available.' }
    }

    const { data: reservationRows, error: reservationError } = await admin
        .from('listing_photos')
        .select('position, storage_path')
        .eq('listing_id', listing.id)
        .order('position', { ascending: true })

    const reservations = reservationRows ?? []

    if (reservationError || !hasValidReservations(user.id, listing.id, reservations)) {
        return { success: false, error: 'The reserved listing photos were not valid.' }
    }

    if (listing.status === 'active') {
        return { success: true }
    }

    if (listing.status !== 'draft') {
        return { success: false, error: 'This draft is no longer available.' }
    }

    const expectedPaths = reservations.map((reservation) => reservation.storage_path)
    const stored = await listStoredPhotoPaths(admin, user.id, listing.id)

    if (
        stored.error
        || stored.hasUnexpectedEntries
        || !haveSamePaths(stored.paths, expectedPaths)
    ) {
        return { success: false, error: 'Not all of the listing photos finished uploading.' }
    }

    for (const path of expectedPaths) {
        const { data: photo, error: downloadError } = await admin.storage
            .from(listingPhotosBucket)
            .download(path)

        if (downloadError || !photo) {
            return { success: false, error: 'One of the photos could not be verified. Please try again.' }
        }

        const verifiedImage = await getVerifiedImageExtension(photo, maxListingPhotoBytes)
        const dimensions = 'error' in verifiedImage
            ? null
            : await getJpegDimensions(photo)

        if (
            'error' in verifiedImage
            || verifiedImage.extension !== 'jpg'
            || !dimensions
            || dimensions.width > maxListingPhotoDimension
            || dimensions.height > maxListingPhotoDimension
            || dimensions.width * dimensions.height > maxListingPhotoPixels
        ) {
            return {
                success: false,
                error: 'Please use valid JPEG photos no larger than 4096 × 4096 pixels.',
            }
        }
    }

    const { data: published, error: publishError } = await admin
        .from('listings')
        .update({ status: 'active' })
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .eq('status', 'draft')
        .is('published_at', null)
        .select('id')
        .maybeSingle()

    if (!publishError && published) {
        revalidatePath('/posts')
        revalidatePath('/profile')
        return { success: true }
    }

    // A lost response or concurrent retry can make the update look ambiguous.
    // Re-read the authoritative row before reporting failure or cleaning up.
    const { data: current } = await admin
        .from('listings')
        .select('status')
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (current?.status === 'active') {
        revalidatePath('/posts')
        revalidatePath('/profile')
        return { success: true }
    }

    console.error('Listing publication failed:', publishError?.code)
    return { success: false, error: 'We could not publish this post right now. Please try again.' }
}

export async function discardListingDraft(
    listingId: unknown,
): Promise<DiscardListingDraftResult> {
    const idValidation = z.string().uuid().safeParse(listingId)

    if (!idValidation.success) {
        return { success: false, error: 'The draft cleanup request was not valid.' }
    }

    const { user } = await getMemberContext()

    if (!user) {
        return { success: false, error: 'You must be logged in.' }
    }

    const admin = createAdminClient()
    const { data: claimed, error: claimError } = await admin
        .from('listings')
        .update({ status: 'archived' })
        .eq('id', idValidation.data)
        .eq('owner_id', user.id)
        .eq('status', 'draft')
        .is('published_at', null)
        .select('id')
        .maybeSingle()

    if (claimError || !claimed) {
        const { data: current, error: currentError } = await admin
            .from('listings')
            .select('status, published_at')
            .eq('id', idValidation.data)
            .eq('owner_id', user.id)
            .maybeSingle()

        if (currentError) {
            return { success: false, error: 'The draft could not be checked right now.' }
        }

        if (claimError) {
            console.error('Listing cleanup claim response was ambiguous:', claimError.code)
        }

        if (current?.status === 'draft') {
            return { success: false, error: 'The draft could not be claimed for cleanup.' }
        }

        if (
            current?.status === 'active'
            || current?.status === 'reserved'
            || current?.status === 'fulfilled'
            || (current?.status === 'archived' && current.published_at !== null)
        ) {
            return { success: true, state: 'published' }
        }

        if (current && !(current.status === 'archived' && current.published_at === null)) {
            return { success: false, error: 'The listing could not be classified for cleanup.' }
        }
    }

    const photosRemoved = await removeAllStoredPhotos(
        admin,
        user.id,
        idValidation.data,
    )

    return photosRemoved
        ? { success: true, state: 'discarded' }
        : {
            success: false,
            error: 'The uploaded photos could not be cleaned up. The hidden draft was kept for retry.',
        }
}
