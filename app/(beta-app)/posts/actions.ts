'use server'

import { revalidatePath } from 'next/cache'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import {
    LISTING_CATEGORIES,
    LISTING_CONDITIONS,
    LISTING_TRANSACTION_TYPES,
} from '@/lib/listings/domain'
import {
    createPostingError,
    type PostingError,
} from '@/lib/listings/posting-errors'
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
    | { success: false; error?: PostingError; fieldErrors?: FieldErrors }

export type ListingActionResult =
    | { success: true }
    | { success: false; error: PostingError }

export type DiscardListingDraftResult =
    | { success: true; state: 'discarded' | 'published' }
    | { success: false; error: PostingError }

const listingDraftSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(1, 'Enter a title.')
            .max(120, 'Keep the title to 120 characters or fewer.'),
        description: z
            .string()
            .trim()
            .min(1, 'Enter a description.')
            .max(3000, 'Keep the description to 3,000 characters or fewer.'),
        category: z.enum(LISTING_CATEGORIES, {
            error: 'Choose a category from the list.',
        }),
        other_category: z
            .string()
            .trim()
            .max(100, 'Keep the category description to 100 characters or fewer.'),
        condition: z.enum(LISTING_CONDITIONS, {
            error: 'Choose the item condition from the list.',
        }),
        transaction_types: z
            .array(z.enum(LISTING_TRANSACTION_TYPES, {
                error: 'Choose only sell, trade, gift, or lend.',
            }))
            .min(1, 'Choose whether you want to sell, trade, gift, or lend this item.')
            .max(4, 'Choose no more than sell, trade, gift, and lend.')
            .transform((types) => [...new Set(types)]),
        price: z.string().trim().max(20, 'The price is too long.'),
        pickup_area: z
            .string()
            .trim()
            .min(1, 'Enter a neighborhood or general pickup area.')
            .max(150, 'Keep the pickup area to 150 characters or fewer.'),
    })
    .superRefine((listing, context) => {
        if (listing.category === 'other' && !listing.other_category) {
            context.addIssue({
                code: 'custom',
                message: 'Describe the item category.',
                path: ['other_category'],
            })
        }

        const isForSale = listing.transaction_types.includes('sell')
        const priceCents = parsePriceCents(listing.price)

        if (isForSale) {
            if (!listing.price) {
                context.addIssue({
                    code: 'custom',
                    message: 'Enter a price when selling an item.',
                    path: ['price'],
                })
            } else if (priceCents === null) {
                context.addIssue({
                    code: 'custom',
                    message: 'Enter the price with up to two decimal places, such as 25.00.',
                    path: ['price'],
                })
            } else if (priceCents <= 0) {
                context.addIssue({
                    code: 'custom',
                    message: 'The sale price must be greater than $0.',
                    path: ['price'],
                })
            } else if (priceCents > maxPostgresInteger) {
                context.addIssue({
                    code: 'custom',
                    message: 'The price cannot exceed $21,474,836.47.',
                    path: ['price'],
                })
            }
        } else if (listing.price) {
            context.addIssue({
                code: 'custom',
                message: 'Remove the price or choose sell.',
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

type MemberContext =
    | { user: User; error: null }
    | { user: null; error: PostingError }

async function getMemberContext(): Promise<MemberContext> {
    let db: Awaited<ReturnType<typeof createClient>>

    try {
        db = await createClient()
    } catch {
        return {
            user: null,
            error: createPostingError(
                'AUTH_CHECK_FAILED',
                'We could not reach the sign-in service. Check your connection and try again.',
                true,
            ),
        }
    }

    const { data: { user }, error: authError } = await db.auth.getUser()

    if (authError) {
        return {
            user: null,
            error: createPostingError(
                'AUTH_CHECK_FAILED',
                'Your sign-in could not be verified. Sign in again before posting.',
                true,
            ),
        }
    }

    if (!user) {
        return {
            user: null,
            error: createPostingError(
                'AUTH_REQUIRED',
                'Sign in before posting a listing.',
            ),
        }
    }

    const { data: profile, error: profileError } = await db
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError) {
        return {
            user: null,
            error: createPostingError(
                'MEMBERSHIP_CHECK_FAILED',
                'We could not verify your membership right now. Your listing was not posted; try again shortly.',
                true,
            ),
        }
    }

    if (!profile) {
        return {
            user: null,
            error: createPostingError(
                'MEMBERSHIP_REQUIRED',
                'Your account is signed in but is not approved for posting listings yet.',
            ),
        }
    }

    return { user, error: null }
}

type ProviderError = {
    code?: string
    message?: string
}

function isSetupError(error: ProviderError) {
    return error.code === 'PGRST205'
        || error.code === '42P01'
        || error.message?.toLowerCase().includes('schema cache') === true
}

function isConnectionError(error: ProviderError) {
    const message = error.message?.toLowerCase() ?? ''
    return message.includes('fetch')
        || message.includes('network')
        || message.includes('timeout')
        || message.includes('connection')
}

function mapDatabaseError(
    error: ProviderError,
    operation: 'create' | 'reserve' | 'lookup' | 'publish',
): PostingError {
    if (isSetupError(error)) {
        if (operation === 'reserve') {
            return createPostingError(
                'PHOTO_STORAGE_SETUP_REQUIRED',
                'Posting is unavailable because listing photo records have not been set up yet. Ask an administrator to apply the posting migration.',
            )
        }

        return createPostingError(
            'POSTING_SETUP_REQUIRED',
            'Posting is unavailable because the listings database has not been set up yet. Ask an administrator to apply the listing migrations.',
        )
    }

    if (error.code === '42501') {
        return createPostingError(
            'POSTING_PERMISSION_DENIED',
            'Posting is unavailable because the server does not have the required database permission. Contact an administrator.',
        )
    }

    if (error.code === '23503') {
        if (operation === 'reserve') {
            return createPostingError(
                'PHOTO_RESERVATION_FAILED',
                'The draft disappeared before its photo uploads could be prepared. Nothing was posted; submit the form again.',
                true,
            )
        }

        if (operation !== 'create') {
            return createPostingError(
                'DRAFT_UNAVAILABLE',
                'The draft is no longer available, so it could not be posted. Submit the form again.',
                true,
            )
        }

        return createPostingError(
            'MEMBERSHIP_REQUIRED',
            'Your member profile is no longer available, so this listing cannot be posted. Sign in again or contact support.',
        )
    }

    if (error.code === '23505') {
        return createPostingError(
            operation === 'create' ? 'LISTING_CREATE_CONFLICT' : 'PHOTO_RESERVATION_FAILED',
            operation === 'create'
                ? 'This posting attempt conflicted with another draft. Nothing was posted; submit it again.'
                : 'The photo upload setup conflicted with another attempt. Nothing was posted; submit it again.',
            true,
        )
    }

    if (isConnectionError(error)) {
        const operationCodes = {
            create: 'LISTING_CREATE_UNAVAILABLE',
            reserve: 'PHOTO_RESERVATION_FAILED',
            lookup: 'DRAFT_LOOKUP_FAILED',
            publish: 'PUBLISH_UNAVAILABLE',
        } as const

        return createPostingError(
            operationCodes[operation],
            'The listing service could not be reached. Check your connection and try again; nothing was posted.',
            true,
        )
    }

    const operationMessages = {
        create: 'The listing service could not save this draft right now. Nothing was posted; try again shortly.',
        reserve: 'The listing details were accepted, but photo uploads could not be prepared. Nothing was posted; try again.',
        lookup: 'The listing service could not check this draft right now. Nothing was posted; try again shortly.',
        publish: 'The listing service could not publish this draft right now. Nothing was posted; try again shortly.',
    } as const

    return createPostingError(
        operation === 'publish'
            ? 'PUBLISH_UNAVAILABLE'
            : operation === 'reserve'
                ? 'PHOTO_RESERVATION_FAILED'
                : operation === 'lookup'
                    ? 'DRAFT_LOOKUP_FAILED'
                    : 'LISTING_CREATE_UNAVAILABLE',
        operationMessages[operation],
        true,
    )
}

function getListingConstraintFailure(error: ProviderError) {
    if (error.code !== '23514') {
        return null
    }

    const message = error.message?.toLowerCase() ?? ''
    const constraints: Array<{ pattern: string; field: string; message: string }> = [
        {
            pattern: 'listings_title_check',
            field: 'title',
            message: 'Enter a visible title of 120 characters or fewer.',
        },
        {
            pattern: 'listings_description_check',
            field: 'description',
            message: 'Enter a visible description of 3,000 characters or fewer.',
        },
        {
            pattern: 'listings_category_check',
            field: 'category',
            message: 'Choose a category from the list.',
        },
        {
            pattern: 'listings_other_category_check',
            field: 'other_category',
            message: 'Describe the other category in 100 characters or fewer.',
        },
        {
            pattern: 'listings_condition_check',
            field: 'condition',
            message: 'Choose the item condition from the list.',
        },
        {
            pattern: 'listings_transaction_types_check',
            field: 'transaction_types',
            message: 'Choose one or more of sell, trade, gift, or lend without duplicates.',
        },
        {
            pattern: 'listings_price_check',
            field: 'price',
            message: 'A sale needs a price greater than $0; non-sale listings cannot include a price.',
        },
        {
            pattern: 'listings_pickup_area_check',
            field: 'pickup_area',
            message: 'Enter a visible pickup area of 150 characters or fewer.',
        },
    ]

    return constraints.find((constraint) => message.includes(constraint.pattern)) ?? {
        field: 'form',
        message: 'One or more listing details did not meet the posting rules.',
    }
}

type StorageProviderError = {
    status?: number
    statusCode?: string
    message?: string
}

function mapServerStorageError(
    error: StorageProviderError,
    operation: 'check' | 'read' | 'cleanup',
    photoNumber?: number,
): PostingError {
    const status = error.status ?? Number(error.statusCode)
    const message = error.message?.toLowerCase() ?? ''
    const photoLabel = photoNumber ? `Photo ${photoNumber}` : 'An uploaded photo'

    if (operation === 'read' && status === 404 && !message.includes('bucket not found')) {
        return createPostingError(
            'PHOTO_VERIFY_READ_FAILED',
            `${photoLabel} is missing from storage, so the listing cannot be posted. Submit the listing again.`,
            true,
        )
    }

    if (status === 404 || message.includes('bucket not found')) {
        return createPostingError(
            'PHOTO_STORAGE_SETUP_REQUIRED',
            'Posting is unavailable because listing photo storage has not been set up yet. Ask an administrator to apply the posting migration.',
        )
    }

    if (status === 401 || status === 403) {
        return createPostingError(
            'POSTING_PERMISSION_DENIED',
            'Posting is unavailable because the server does not have the required photo-storage permission. Contact an administrator.',
        )
    }

    if (operation === 'cleanup') {
        return createPostingError(
            'CLEANUP_STORAGE_FAILED',
            'No new listing was posted, but its uploaded photos could not yet be removed. Wait a moment and retry before posting again.',
            true,
        )
    }

    return createPostingError(
        operation === 'read' ? 'PHOTO_VERIFY_READ_FAILED' : 'PHOTO_STORAGE_CHECK_FAILED',
        operation === 'read'
            ? `${photoLabel} could not be read back from storage. Nothing was posted; submit the listing again.`
            : 'The uploaded photos could not be checked because the photo service is unavailable. Nothing was posted; try again shortly.',
        true,
    )
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
        console.warn('Listing photo enumeration failed:', error.statusCode)
        return {
            paths: null,
            error: mapServerStorageError(error, 'check'),
        } as const
    }

    const paths = (data ?? [])
        .filter((item) => Boolean(item.id))
        .map((item) => `${prefix}/${item.name}`)

    const hasUnexpectedEntries = (data ?? []).some(
        (item) => !item.id || !listingPhotoNamePattern.test(item.name),
    )

    return { paths, hasUnexpectedEntries, error: null } as const
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
            console.warn('Listing photo cleanup failed:', error.statusCode)
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
        console.warn('Listing tombstone sweep query failed:', error.code)
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
            console.warn('Listing tombstone sweep delete failed:', deleteError.code)
        }
    }
}

export async function createListingDraft(
    formData: FormData,
    photoCount: unknown,
): Promise<CreateListingDraftResult> {
    if (!(formData instanceof FormData)) {
        return {
            success: false,
            error: createPostingError(
                'FORM_INVALID',
                'This post form could not be read. Refresh the page and enter the listing again.',
                true,
            ),
        }
    }

    const member = await getMemberContext()

    if (member.error) {
        return { success: false, error: member.error }
    }

    const { user } = member

    const photoCountResult = z.number().int().min(1).max(5).safeParse(photoCount)

    if (!photoCountResult.success) {
        return {
            success: false,
            error: createPostingError(
                'PHOTO_COUNT_INVALID',
                'This listing was not posted because it needs between 1 and 5 photos.',
            ),
            fieldErrors: { photos: 'Choose between 1 and 5 photos.' },
        }
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
            error: createPostingError(
                'LISTING_DETAILS_REJECTED',
                'This listing was not posted because some details need to be corrected.',
            ),
            fieldErrors: buildFieldErrors(validationFields.error),
        }
    }

    const listing = validationFields.data
    const listingId = crypto.randomUUID()
    const photoPaths = createReservedPhotoPaths(user.id, listingId, photoCountResult.data)
    const isForSale = listing.transaction_types.includes('sell')
    let admin: ReturnType<typeof createAdminClient>

    try {
        admin = createAdminClient()
    } catch {
        return {
            success: false,
            error: createPostingError(
                'POSTING_SETUP_REQUIRED',
                'Posting is unavailable because the server connection is not configured. Contact an administrator.',
            ),
        }
    }

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
        console.warn('Listing draft creation failed:', listingError.code)

        const constraint = getListingConstraintFailure(listingError)

        if (constraint) {
            return {
                success: false,
                error: createPostingError(
                    'LISTING_DETAILS_REJECTED',
                    `This listing was not posted. ${constraint.message}`,
                ),
                fieldErrors: { [constraint.field]: constraint.message },
            }
        }

        return {
            success: false,
            error: mapDatabaseError(listingError, 'create'),
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
        console.warn('Listing photo reservation failed:', reservationError.code)
        await admin
            .from('listings')
            .delete()
            .eq('id', listingId)
            .eq('owner_id', user.id)
            .eq('status', 'draft')

        return {
            success: false,
            error: mapDatabaseError(reservationError, 'reserve'),
        }
    }

    return { success: true, listingId, photoPaths }
}

export async function finalizeListing(listingId: unknown): Promise<ListingActionResult> {
    const idValidation = z.string().uuid().safeParse(listingId)

    if (!idValidation.success) {
        return {
            success: false,
            error: createPostingError(
                'LISTING_ID_INVALID',
                'This posting attempt is invalid. Refresh the page and start the listing again.',
            ),
        }
    }

    const member = await getMemberContext()

    if (member.error) {
        return { success: false, error: member.error }
    }

    const { user } = member
    let admin: ReturnType<typeof createAdminClient>

    try {
        admin = createAdminClient()
    } catch {
        return {
            success: false,
            error: createPostingError(
                'POSTING_SETUP_REQUIRED',
                'Posting is unavailable because the server connection is not configured. Contact an administrator.',
            ),
        }
    }

    const { data: listing, error: listingError } = await admin
        .from('listings')
        .select('id, status')
        .eq('id', idValidation.data)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (listingError) {
        console.warn('Listing draft lookup failed:', listingError.code)
        return { success: false, error: mapDatabaseError(listingError, 'lookup') }
    }

    if (!listing) {
        return {
            success: false,
            error: createPostingError(
                'DRAFT_UNAVAILABLE',
                'This draft expired, was removed, or belongs to a different account. Nothing was posted; start a new posting attempt.',
            ),
        }
    }

    if (
        listing.status === 'active'
        || listing.status === 'reserved'
        || listing.status === 'fulfilled'
    ) {
        revalidatePath('/posts')
        revalidatePath('/profile')
        return { success: true }
    }

    if (listing.status === 'archived') {
        return {
            success: false,
            error: createPostingError(
                'DRAFT_CANCELLED',
                'This posting attempt was already canceled. Nothing was posted; submit the form again to start a new attempt.',
            ),
        }
    }

    if (listing.status !== 'draft') {
        return {
            success: false,
            error: createPostingError(
                'PUBLISH_STATE_CONFLICT',
                'This draft changed status before publication. Check My Listings before submitting it again.',
            ),
        }
    }

    const { data: reservationRows, error: reservationError } = await admin
        .from('listing_photos')
        .select('position, storage_path')
        .eq('listing_id', listing.id)
        .order('position', { ascending: true })

    if (reservationError) {
        console.warn('Listing photo reservation lookup failed:', reservationError.code)

        if (isSetupError(reservationError)) {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_STORAGE_SETUP_REQUIRED',
                    'Posting is unavailable because listing photo records have not been set up yet. Ask an administrator to apply the posting migration.',
                ),
            }
        }

        if (reservationError.code === '42501') {
            return { success: false, error: mapDatabaseError(reservationError, 'lookup') }
        }

        return {
            success: false,
            error: createPostingError(
                'PHOTO_RESERVATIONS_INVALID',
                'The photo records for this draft could not be checked. Nothing was posted; try submitting the listing again.',
                true,
            ),
        }
    }

    const reservations = reservationRows ?? []

    if (reservations.length === 0) {
        return {
            success: false,
            error: createPostingError(
                'PHOTO_RESERVATIONS_MISSING',
                'No photo uploads were prepared for this draft. Nothing was posted; submit the listing again.',
            ),
        }
    }

    if (!hasValidReservations(user.id, listing.id, reservations)) {
        return {
            success: false,
            error: createPostingError(
                'PHOTO_RESERVATIONS_INVALID',
                'The photo upload setup for this draft is incomplete or invalid. Nothing was posted; submit the listing again.',
            ),
        }
    }

    const expectedPaths = reservations.map((reservation) => reservation.storage_path)
    const stored = await listStoredPhotoPaths(admin, user.id, listing.id)

    if (stored.error) {
        return { success: false, error: stored.error }
    }

    const unexpectedPaths = stored.paths.filter((path) => !expectedPaths.includes(path))

    if (stored.hasUnexpectedEntries || unexpectedPaths.length > 0) {
        return {
            success: false,
            error: createPostingError(
                'PHOTO_UPLOAD_SET_INVALID',
                'The uploaded photos did not match this draft. Nothing was posted; submit again to create a fresh photo upload.',
            ),
        }
    }

    const missingPhotoNumbers = expectedPaths
        .map((path, index) => stored.paths.includes(path) ? null : index + 1)
        .filter((index): index is number => index !== null)

    if (!haveSamePaths(stored.paths, expectedPaths)) {
        const photoLabel = missingPhotoNumbers.length === 1
            ? `Photo ${missingPhotoNumbers[0]}`
            : `Photos ${missingPhotoNumbers.join(', ')}`

        return {
            success: false,
            error: createPostingError(
                'PHOTO_UPLOAD_INCOMPLETE',
                `${photoLabel} did not finish uploading. Nothing was posted; submit the listing again.`,
                true,
            ),
        }
    }

    for (const [index, path] of expectedPaths.entries()) {
        const photoNumber = index + 1
        const { data: photo, error: downloadError } = await admin.storage
            .from(listingPhotosBucket)
            .download(path)

        if (downloadError || !photo) {
            console.warn('Listing photo download failed:', downloadError?.statusCode)
            const mapped = downloadError
                ? mapServerStorageError(downloadError, 'read', photoNumber)
                : createPostingError(
                    'PHOTO_VERIFY_READ_FAILED',
                    `Photo ${photoNumber} uploaded but could not be read back. Nothing was posted; submit the listing again.`,
                    true,
                )

            return {
                success: false,
                error: mapped,
            }
        }

        if (photo.size > maxListingPhotoBytes) {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_OUTPUT_TOO_LARGE',
                    `Photo ${photoNumber} is larger than the 5 MB posting limit. Nothing was posted; choose a smaller image.`,
                ),
            }
        }

        if (photo.type !== 'image/jpeg') {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_TYPE_UNSUPPORTED',
                    `Photo ${photoNumber} was not stored as a JPEG. Nothing was posted; choose that photo again.`,
                ),
            }
        }

        const verifiedImage = await getVerifiedImageExtension(photo, maxListingPhotoBytes)

        if ('error' in verifiedImage || verifiedImage.extension !== 'jpg') {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_CORRUPT',
                    `Photo ${photoNumber} is damaged, incomplete, or not a valid JPEG. Nothing was posted; choose a different copy of that photo.`,
                ),
            }
        }

        const dimensions = await getJpegDimensions(photo)

        if (!dimensions) {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_CORRUPT',
                    `Photo ${photoNumber} is damaged or incomplete, so its dimensions could not be read. Nothing was posted.`,
                ),
            }
        }

        if (
            dimensions.width > maxListingPhotoDimension
            || dimensions.height > maxListingPhotoDimension
        ) {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_DIMENSIONS_TOO_LARGE',
                    `Photo ${photoNumber} is ${dimensions.width} × ${dimensions.height} pixels. Each side must be 4,096 pixels or smaller.`,
                ),
            }
        }

        if (dimensions.width * dimensions.height > maxListingPhotoPixels) {
            return {
                success: false,
                error: createPostingError(
                    'PHOTO_PIXEL_COUNT_TOO_HIGH',
                    `Photo ${photoNumber} contains more than 16 megapixels. Nothing was posted; choose a smaller image.`,
                ),
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
    const { data: current, error: currentError } = await admin
        .from('listings')
        .select('status')
        .eq('id', listing.id)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (
        current?.status === 'active'
        || current?.status === 'reserved'
        || current?.status === 'fulfilled'
    ) {
        revalidatePath('/posts')
        revalidatePath('/profile')
        return { success: true }
    }

    console.warn('Listing publication failed:', publishError?.code)

    if (currentError) {
        console.warn('Listing publication confirmation failed:', currentError.code)
        return {
            success: false,
            error: createPostingError(
                'PUBLISH_STATE_CONFLICT',
                'The listing service could not confirm whether this draft was published. Check My Listings before submitting it again.',
            ),
        }
    }

    if (!current) {
        return {
            success: false,
            error: createPostingError(
                'DRAFT_UNAVAILABLE',
                'The draft disappeared before publication could be confirmed. Check My Listings; if it is absent, submit the form again.',
            ),
        }
    }

    if (current.status === 'archived') {
        return {
            success: false,
            error: createPostingError(
                'DRAFT_CANCELLED',
                'This posting attempt was canceled before publication finished. Nothing was posted; submit the form again.',
            ),
        }
    }

    if (publishError) {
        return { success: false, error: mapDatabaseError(publishError, 'publish') }
    }

    return {
        success: false,
        error: createPostingError(
            'PUBLISH_STATE_CONFLICT',
            'This draft changed while it was being published. Check My Listings before submitting it again.',
        ),
    }
}

export async function discardListingDraft(
    listingId: unknown,
): Promise<DiscardListingDraftResult> {
    const idValidation = z.string().uuid().safeParse(listingId)

    if (!idValidation.success) {
        return {
            success: false,
            error: createPostingError(
                'CLEANUP_ID_INVALID',
                'The previous posting attempt could not be identified. Refresh the page before posting again.',
            ),
        }
    }

    const member = await getMemberContext()

    if (member.error) {
        if (member.error.code === 'AUTH_REQUIRED') {
            return {
                success: false,
                error: createPostingError(
                    'CLEANUP_AUTH_REQUIRED',
                    'Sign in again so the previous posting attempt can be cleared before you post another listing.',
                    true,
                ),
            }
        }

        if (member.error.code === 'AUTH_CHECK_FAILED') {
            return {
                success: false,
                error: createPostingError(
                    'CLEANUP_UNAVAILABLE',
                    'The sign-in service could not be reached, so the previous posting attempt could not be cleared. Check your connection and try again.',
                    true,
                ),
            }
        }

        return { success: false, error: member.error }
    }

    const { user } = member
    let admin: ReturnType<typeof createAdminClient>

    try {
        admin = createAdminClient()
    } catch {
        return {
            success: false,
            error: createPostingError(
                'CLEANUP_UNAVAILABLE',
                'The listing service is not configured, so the previous posting attempt could not be cleared. Contact an administrator.',
            ),
        }
    }

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
            console.warn('Listing cleanup state lookup failed:', currentError.code)
            return {
                success: false,
                error: createPostingError(
                    'CLEANUP_LOOKUP_FAILED',
                    'The previous posting attempt could not be checked because the listing service is unavailable. Wait a moment and try again.',
                    true,
                ),
            }
        }

        if (claimError) {
            console.warn('Listing cleanup claim response was ambiguous:', claimError.code)
        }

        if (current?.status === 'draft') {
            if (claimError) {
                if (isSetupError(claimError)) {
                    return {
                        success: false,
                        error: createPostingError(
                            'POSTING_SETUP_REQUIRED',
                            'The previous posting attempt could not be cleared because the listings database is not set up. Ask an administrator to apply the listing migrations.',
                        ),
                    }
                }

                if (claimError.code === '42501') {
                    return {
                        success: false,
                        error: createPostingError(
                            'POSTING_PERMISSION_DENIED',
                            'The previous posting attempt could not be cleared because the server lacks database permission. Contact an administrator.',
                        ),
                    }
                }

                return {
                    success: false,
                    error: createPostingError(
                        'CLEANUP_UNAVAILABLE',
                        'The listing service refused to clear the previous posting attempt. Nothing was published; wait a moment and try again.',
                        true,
                    ),
                }
            }

            return {
                success: false,
                error: createPostingError(
                    'CLEANUP_BUSY',
                    'The previous posting attempt is still being processed. Wait a moment and try posting again.',
                    true,
                ),
            }
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
            return {
                success: false,
                error: createPostingError(
                    'CLEANUP_STATE_INVALID',
                    'The previous posting attempt changed unexpectedly. Check My Listings before trying to post again.',
                ),
            }
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
            error: createPostingError(
                'CLEANUP_STORAGE_FAILED',
                'No new listing was posted, but its uploaded photos could not yet be removed. Wait a moment and retry before posting again.',
                true,
            ),
        }
}
