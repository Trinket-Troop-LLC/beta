'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const listingPhotosBucket = 'listing-photos'
const deletableListingStatuses = ['active', 'reserved', 'fulfilled'] as const
const storageListPageSize = 100
const maxStorageListRequests = 200
const maxStorageDirectories = 1_000
const maxStorageObjects = 10_000
const maxStorageDepth = 20
const storageRemoveBatchSize = 1_000
const maxStorageRemovalPasses = 3

const uuidSchema = z.string().uuid()
const listingPhotoNamePattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png)$/

export const LISTING_DELETION_ERROR_CODES = [
    'LISTING_ID_INVALID',
    'DELETE_AUTH_REQUIRED',
    'DELETE_AUTH_CHECK_FAILED',
    'DELETE_MEMBERSHIP_REQUIRED',
    'DELETE_MEMBERSHIP_CHECK_FAILED',
    'DELETE_SERVICE_UNAVAILABLE',
    'DELETE_STATE_INVALID',
    'DELETE_TOMBSTONE_FAILED',
    'DELETE_PHOTO_METADATA_FAILED',
    'DELETE_PHOTO_METADATA_INVALID',
    'DELETE_STORAGE_ENUMERATION_FAILED',
    'DELETE_STORAGE_LIMIT_EXCEEDED',
    'DELETE_STORAGE_PATH_UNSAFE',
    'DELETE_STORAGE_FAILED',
    'DELETE_STORAGE_NOT_EMPTY',
    'DELETE_ROW_FAILED',
    'DELETE_CONFIRMATION_FAILED',
] as const

type ListingDeletionErrorCode = (typeof LISTING_DELETION_ERROR_CODES)[number]

export type ListingDeletionError = {
    code: ListingDeletionErrorCode
    message: string
    retryable: boolean
}

export type DeleteListingResult =
    | { success: true }
    | { success: false; error: ListingDeletionError }

type ProviderError = {
    code?: string
    status?: number
    statusCode?: number | string
}

type OwnedListingState = {
    id: string
    status: string
    published_at: string | null
}

type QueryResult<T> = {
    data: T | null
    error: ProviderError | null
}

type StorageEnumerationResult =
    | { success: true; paths: string[] }
    | { success: false; error: ListingDeletionError }

type StoragePrefixProbeResult =
    | { success: true; empty: boolean }
    | { success: false; error: ListingDeletionError }

function createDeletionError(
    code: ListingDeletionErrorCode,
    message: string,
    retryable = false,
): ListingDeletionError {
    return { code, message, retryable }
}

function getProviderCode(error: ProviderError) {
    return error.code ?? error.statusCode ?? error.status ?? 'unknown'
}

function canonicalizeUuid(value: string) {
    const parsed = uuidSchema.safeParse(value)
    return parsed.success ? parsed.data.toLowerCase() : null
}

async function getApprovedMemberId(): Promise<
    | { userId: string; error: null }
    | { userId: null; error: ListingDeletionError }
> {
    let db: Awaited<ReturnType<typeof createClient>>

    try {
        db = await createClient()
    } catch {
        return {
            userId: null,
            error: createDeletionError(
                'DELETE_AUTH_CHECK_FAILED',
                'We could not reach the sign-in service. Check your connection and try again.',
                true,
            ),
        }
    }

    let user: { id: string } | null

    try {
        const { data, error } = await db.auth.getUser()

        if (error) {
            return {
                userId: null,
                error: createDeletionError(
                    'DELETE_AUTH_CHECK_FAILED',
                    'Your sign-in could not be verified. Sign in again before deleting this listing.',
                    true,
                ),
            }
        }

        user = data.user
    } catch {
        return {
            userId: null,
            error: createDeletionError(
                'DELETE_AUTH_CHECK_FAILED',
                'We could not reach the sign-in service. Check your connection and try again.',
                true,
            ),
        }
    }

    if (!user) {
        return {
            userId: null,
            error: createDeletionError(
                'DELETE_AUTH_REQUIRED',
                'Sign in again before deleting this listing.',
            ),
        }
    }

    try {
        const { data: profile, error } = await db
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle()

        if (error) {
            return {
                userId: null,
                error: createDeletionError(
                    'DELETE_MEMBERSHIP_CHECK_FAILED',
                    'We could not verify your membership right now. Try deleting the listing again shortly.',
                    true,
                ),
            }
        }

        const userId = typeof profile?.id === 'string'
            ? canonicalizeUuid(profile.id)
            : null

        if (!userId) {
            return {
                userId: null,
                error: createDeletionError(
                    'DELETE_MEMBERSHIP_REQUIRED',
                    'Your account is not approved to manage listings.',
                ),
            }
        }

        return { userId, error: null }
    } catch {
        return {
            userId: null,
            error: createDeletionError(
                'DELETE_MEMBERSHIP_CHECK_FAILED',
                'We could not verify your membership right now. Try deleting the listing again shortly.',
                true,
            ),
        }
    }
}

async function readOwnedListingState(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<QueryResult<OwnedListingState>> {
    try {
        const { data, error } = await admin
            .from('listings')
            .select('id, status, published_at')
            .eq('id', listingId)
            .eq('owner_id', userId)
            .maybeSingle()

        return {
            data: data as OwnedListingState | null,
            error,
        }
    } catch {
        return {
            data: null,
            error: { code: 'REQUEST_FAILED' },
        }
    }
}

async function claimDeletionTombstone(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<
    | { state: 'gone'; listingId: string }
    | { state: 'tombstone'; listingId: string }
    | { state: 'rejected'; error: ListingDeletionError }
> {
    let claim: QueryResult<OwnedListingState>

    try {
        const { data, error } = await admin
            .from('listings')
            .update({ status: 'archived' })
            .eq('id', listingId)
            .eq('owner_id', userId)
            .in('status', deletableListingStatuses)
            .not('published_at', 'is', null)
            .select('id, status, published_at')
            .maybeSingle()

        claim = {
            data: data as OwnedListingState | null,
            error,
        }
    } catch {
        claim = {
            data: null,
            error: { code: 'REQUEST_FAILED' },
        }
    }

    const claimedId = typeof claim.data?.id === 'string'
        ? canonicalizeUuid(claim.data.id)
        : null

    if (
        claimedId
        && claim.data?.status === 'archived'
        && claim.data.published_at !== null
    ) {
        return { state: 'tombstone', listingId: claimedId }
    }

    const current = await readOwnedListingState(admin, userId, listingId)

    if (current.error) {
        console.warn(
            'Listing deletion state confirmation failed:',
            getProviderCode(current.error),
        )
        return {
            state: 'rejected',
            error: createDeletionError(
                'DELETE_TOMBSTONE_FAILED',
                'The listing service could not safely begin deletion. The listing was not removed; try again shortly.',
                true,
            ),
        }
    }

    if (!current.data) {
        return { state: 'gone', listingId }
    }

    const currentId = canonicalizeUuid(current.data.id)

    if (!currentId) {
        return {
            state: 'rejected',
            error: createDeletionError(
                'DELETE_STATE_INVALID',
                'This listing has an invalid database identifier and cannot be deleted safely. Contact support.',
            ),
        }
    }

    if (
        current.data.status === 'archived'
        && current.data.published_at !== null
    ) {
        return { state: 'tombstone', listingId: currentId }
    }

    if (
        current.data.status === 'draft'
        || (
            current.data.status === 'archived'
            && current.data.published_at === null
        )
    ) {
        return {
            state: 'rejected',
            error: createDeletionError(
                'DELETE_STATE_INVALID',
                'Only published listings can be permanently deleted from My Listings.',
            ),
        }
    }

    if (
        deletableListingStatuses.includes(
            current.data.status as (typeof deletableListingStatuses)[number],
        )
    ) {
        if (claim.error) {
            console.warn(
                'Listing deletion tombstone update failed:',
                getProviderCode(claim.error),
            )
        }

        return {
            state: 'rejected',
            error: createDeletionError(
                'DELETE_TOMBSTONE_FAILED',
                'The listing could not be hidden safely before deletion. Try again shortly.',
                true,
            ),
        }
    }

    return {
        state: 'rejected',
        error: createDeletionError(
            'DELETE_STATE_INVALID',
            'The listing changed unexpectedly and cannot be deleted safely. Refresh My Listings and try again.',
            true,
        ),
    }
}

function isValidMetadataPath(
    path: unknown,
    userId: string,
    listingId: string,
) {
    if (typeof path !== 'string') {
        return false
    }

    const prefix = `${userId}/${listingId}/`

    if (!path.startsWith(prefix)) {
        return false
    }

    const name = path.slice(prefix.length)
    return !name.includes('/')
        && !name.includes('\\')
        && listingPhotoNamePattern.test(name)
}

async function validateListingPhotoMetadata(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<
    | { state: 'valid' }
    | { state: 'gone' }
    | { state: 'error'; error: ListingDeletionError }
> {
    let result: QueryResult<unknown>

    try {
        const { data, error } = await admin
            .from('listings')
            .select('id, status, published_at, listing_photos(storage_path)')
            .eq('id', listingId)
            .eq('owner_id', userId)
            .eq('status', 'archived')
            .not('published_at', 'is', null)
            .maybeSingle()

        result = { data, error }
    } catch {
        result = {
            data: null,
            error: { code: 'REQUEST_FAILED' },
        }
    }

    if (result.error) {
        console.warn(
            'Listing photo metadata lookup failed:',
            getProviderCode(result.error),
        )
        return {
            state: 'error',
            error: createDeletionError(
                'DELETE_PHOTO_METADATA_FAILED',
                'The listing is hidden, but its photo records could not be checked. Try Finish deleting again.',
                true,
            ),
        }
    }

    if (!result.data) {
        const current = await readOwnedListingState(admin, userId, listingId)

        if (current.error) {
            console.warn(
                'Listing metadata state confirmation failed:',
                getProviderCode(current.error),
            )
            return {
                state: 'error',
                error: createDeletionError(
                    'DELETE_CONFIRMATION_FAILED',
                    'The listing service could not confirm the deletion state. Refresh My Listings and try again.',
                    true,
                ),
            }
        }

        if (!current.data) {
            return { state: 'gone' }
        }

        return {
            state: 'error',
            error: createDeletionError(
                'DELETE_STATE_INVALID',
                'The listing changed while deletion was in progress. Refresh My Listings and try again.',
                true,
            ),
        }
    }

    const row = result.data as {
        id?: unknown
        status?: unknown
        published_at?: unknown
        listing_photos?: unknown
    }
    const canonicalId = typeof row.id === 'string'
        ? canonicalizeUuid(row.id)
        : null
    const photos = row.listing_photos

    if (
        canonicalId !== listingId
        || row.status !== 'archived'
        || typeof row.published_at !== 'string'
        || !Array.isArray(photos)
        || photos.length > 5
    ) {
        return {
            state: 'error',
            error: createDeletionError(
                'DELETE_PHOTO_METADATA_INVALID',
                'The listing is hidden, but its photo records are invalid. Try again or contact support.',
                true,
            ),
        }
    }

    const paths = photos.map((photo) => {
        if (!photo || typeof photo !== 'object') {
            return null
        }

        return 'storage_path' in photo
            ? (photo as { storage_path?: unknown }).storage_path
            : null
    })

    if (
        paths.some((path) => !isValidMetadataPath(path, userId, listingId))
        || new Set(paths).size !== paths.length
    ) {
        return {
            state: 'error',
            error: createDeletionError(
                'DELETE_PHOTO_METADATA_INVALID',
                'The listing is hidden, but its photo records are invalid. Try again or contact support.',
                true,
            ),
        }
    }

    return { state: 'valid' }
}

function isSafeStorageSegment(segment: string) {
    return segment.length > 0
        && segment !== '.'
        && segment !== '..'
        && !segment.includes('/')
        && !segment.includes('\\')
        && !/[\u0000-\u001f\u007f]/.test(segment)
}

function joinSafeStoragePath(
    rootPrefix: string,
    directory: string,
    name: string,
) {
    if (
        !isSafeStorageSegment(name)
        || (
            directory !== rootPrefix
            && !directory.startsWith(`${rootPrefix}/`)
        )
    ) {
        return null
    }

    const path = `${directory}/${name}`
    const relativePath = path.slice(rootPrefix.length + 1)
    const segments = relativePath.split('/')

    if (
        path.length > 1_024
        || !path.startsWith(`${rootPrefix}/`)
        || segments.length > maxStorageDepth
        || segments.some((segment) => !isSafeStorageSegment(segment))
    ) {
        return null
    }

    return path
}

function storageEnumerationError(
    code:
        | 'DELETE_STORAGE_ENUMERATION_FAILED'
        | 'DELETE_STORAGE_LIMIT_EXCEEDED'
        | 'DELETE_STORAGE_PATH_UNSAFE',
    message: string,
) {
    return {
        success: false,
        error: createDeletionError(code, message, true),
    } as const
}

async function enumerateStoredListingPhotos(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<StorageEnumerationResult> {
    const rootPrefix = `${userId}/${listingId}`
    const directories = [rootPrefix]
    const seenDirectories = new Set(directories)
    const paths = new Set<string>()
    let directoryIndex = 0
    let requestCount = 0

    while (directoryIndex < directories.length) {
        const directory = directories[directoryIndex]
        directoryIndex += 1
        let offset = 0

        while (true) {
            requestCount += 1

            if (requestCount > maxStorageListRequests) {
                return storageEnumerationError(
                    'DELETE_STORAGE_LIMIT_EXCEEDED',
                    'The listing is hidden, but it has too many stored photo entries to delete safely. Try again or contact support.',
                )
            }

            let response: Awaited<ReturnType<
                ReturnType<typeof admin.storage.from>['list']
            >>

            try {
                response = await admin.storage
                    .from(listingPhotosBucket)
                    .list(directory, {
                        limit: storageListPageSize,
                        offset,
                        sortBy: { column: 'name', order: 'asc' },
                    })
            } catch {
                return storageEnumerationError(
                    'DELETE_STORAGE_ENUMERATION_FAILED',
                    'The listing is hidden, but its stored photos could not be checked. Try Finish deleting again.',
                )
            }

            if (response.error) {
                console.warn(
                    'Listing photo enumeration failed:',
                    getProviderCode(response.error),
                )
                return storageEnumerationError(
                    'DELETE_STORAGE_ENUMERATION_FAILED',
                    'The listing is hidden, but its stored photos could not be checked. Try Finish deleting again.',
                )
            }

            const entries = response.data ?? []

            for (const entry of entries) {
                const path = joinSafeStoragePath(
                    rootPrefix,
                    directory,
                    entry.name,
                )

                if (!path) {
                    return storageEnumerationError(
                        'DELETE_STORAGE_PATH_UNSAFE',
                        'The listing is hidden, but an unsafe photo path prevented deletion. Try again or contact support.',
                    )
                }

                if (entry.id === null) {
                    if (!seenDirectories.has(path)) {
                        seenDirectories.add(path)
                        directories.push(path)

                        if (directories.length > maxStorageDirectories) {
                            return storageEnumerationError(
                                'DELETE_STORAGE_LIMIT_EXCEEDED',
                                'The listing is hidden, but it has too many photo folders to delete safely. Try again or contact support.',
                            )
                        }
                    }
                } else if (typeof entry.id === 'string' && entry.id.length > 0) {
                    paths.add(path)

                    if (paths.size > maxStorageObjects) {
                        return storageEnumerationError(
                            'DELETE_STORAGE_LIMIT_EXCEEDED',
                            'The listing is hidden, but it has too many stored photos to delete safely. Try again or contact support.',
                        )
                    }
                } else {
                    return storageEnumerationError(
                        'DELETE_STORAGE_PATH_UNSAFE',
                        'The listing is hidden, but an invalid photo entry prevented deletion. Try again or contact support.',
                    )
                }
            }

            if (entries.length < storageListPageSize) {
                break
            }

            offset += entries.length
        }
    }

    return {
        success: true,
        paths: [...paths].sort(),
    }
}

async function probeListingPhotoPrefixEmpty(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<StoragePrefixProbeResult> {
    try {
        const { data, error } = await admin.storage
            .from(listingPhotosBucket)
            .list(`${userId}/${listingId}`, {
                limit: 1,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            })

        if (error) {
            console.warn(
                'Listing photo empty-prefix confirmation failed:',
                getProviderCode(error),
            )
            return storageEnumerationError(
                'DELETE_STORAGE_ENUMERATION_FAILED',
                'The listing is hidden, but its stored photos could not be confirmed deleted. Try Finish deleting again.',
            )
        }

        return {
            success: true,
            empty: (data ?? []).length === 0,
        }
    } catch {
        return storageEnumerationError(
            'DELETE_STORAGE_ENUMERATION_FAILED',
            'The listing is hidden, but its stored photos could not be confirmed deleted. Try Finish deleting again.',
        )
    }
}

function isPathWithinStoragePrefix(path: string, rootPrefix: string) {
    return path.startsWith(`${rootPrefix}/`)
        && path
            .slice(rootPrefix.length + 1)
            .split('/')
            .every(isSafeStorageSegment)
}

async function removeStoredPaths(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
    paths: string[],
) {
    const rootPrefix = `${userId}/${listingId}`

    if (paths.some((path) => !isPathWithinStoragePrefix(path, rootPrefix))) {
        return false
    }

    for (let index = 0; index < paths.length; index += storageRemoveBatchSize) {
        const batch = paths.slice(index, index + storageRemoveBatchSize)

        try {
            const { error } = await admin.storage
                .from(listingPhotosBucket)
                .remove(batch)

            if (error) {
                console.warn(
                    'Listing photo removal response failed:',
                    getProviderCode(error),
                )
                return false
            }
        } catch {
            return false
        }
    }

    return true
}

async function removeAllListingPhotos(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<
    | { success: true }
    | { success: false; error: ListingDeletionError }
> {
    let current = await enumerateStoredListingPhotos(admin, userId, listingId)
    let removalFailed = false

    if (!current.success) {
        return current
    }

    for (let pass = 0; pass < maxStorageRemovalPasses; pass += 1) {
        if (current.paths.length === 0) {
            const emptyConfirmation = await enumerateStoredListingPhotos(
                admin,
                userId,
                listingId,
            )

            if (!emptyConfirmation.success) {
                return emptyConfirmation
            }

            if (emptyConfirmation.paths.length === 0) {
                const emptyProbe = await probeListingPhotoPrefixEmpty(
                    admin,
                    userId,
                    listingId,
                )

                if (!emptyProbe.success) {
                    return emptyProbe
                }

                if (emptyProbe.empty) {
                    return { success: true }
                }

                current = emptyConfirmation
                continue
            }

            current = emptyConfirmation
        }

        const removed = await removeStoredPaths(
            admin,
            userId,
            listingId,
            current.paths,
        )
        removalFailed ||= !removed

        const remaining = await enumerateStoredListingPhotos(
            admin,
            userId,
            listingId,
        )

        if (!remaining.success) {
            return remaining
        }

        if (remaining.paths.length === 0) {
            const emptyProbe = await probeListingPhotoPrefixEmpty(
                admin,
                userId,
                listingId,
            )

            if (!emptyProbe.success) {
                return emptyProbe
            }

            if (emptyProbe.empty) {
                return { success: true }
            }
        }

        current = remaining
    }

    return {
        success: false,
        error: createDeletionError(
            removalFailed ? 'DELETE_STORAGE_FAILED' : 'DELETE_STORAGE_NOT_EMPTY',
            removalFailed
                ? 'The listing is hidden, but not all of its photos could be removed. Try Finish deleting again.'
                : 'The listing is hidden, but its photo cleanup could not be confirmed complete. Try Finish deleting again.',
            true,
        ),
    }
}

async function deleteAndConfirmListingRow(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    listingId: string,
): Promise<DeleteListingResult> {
    let deleteError: ProviderError | null = null

    try {
        const { error } = await admin
            .from('listings')
            .delete()
            .eq('id', listingId)
            .eq('owner_id', userId)
            .eq('status', 'archived')
            .not('published_at', 'is', null)
            .select('id')
            .maybeSingle()

        deleteError = error
    } catch {
        deleteError = { code: 'REQUEST_FAILED' }
    }

    const current = await readOwnedListingState(admin, userId, listingId)

    if (current.error) {
        console.warn(
            'Listing row deletion confirmation failed:',
            getProviderCode(current.error),
        )
        return {
            success: false,
            error: createDeletionError(
                'DELETE_CONFIRMATION_FAILED',
                'The listing service could not confirm whether database cleanup finished. Refresh My Listings and try Finish deleting again.',
                true,
            ),
        }
    }

    if (!current.data) {
        return { success: true }
    }

    if (deleteError) {
        console.warn(
            'Listing row deletion response failed:',
            getProviderCode(deleteError),
        )
    }

    return {
        success: false,
        error: createDeletionError(
            'DELETE_ROW_FAILED',
            'All stored photos were removed, but the hidden listing could not be deleted. Try Finish deleting again.',
            true,
        ),
    }
}

export async function deleteListing(listingId: unknown): Promise<DeleteListingResult> {
    const validatedListingId = typeof listingId === 'string'
        ? canonicalizeUuid(listingId)
        : null

    if (!validatedListingId) {
        return {
            success: false,
            error: createDeletionError(
                'LISTING_ID_INVALID',
                'This listing could not be identified. Refresh My Listings and try again.',
            ),
        }
    }

    const member = await getApprovedMemberId()

    if (member.error) {
        return { success: false, error: member.error }
    }

    let admin: ReturnType<typeof createAdminClient>

    try {
        admin = createAdminClient()
    } catch {
        return {
            success: false,
            error: createDeletionError(
                'DELETE_SERVICE_UNAVAILABLE',
                'The listing deletion service is not configured. Contact an administrator.',
            ),
        }
    }

    const claim = await claimDeletionTombstone(
        admin,
        member.userId,
        validatedListingId,
    )

    if (claim.state === 'rejected') {
        return { success: false, error: claim.error }
    }

    if (claim.state === 'tombstone') {
        revalidatePath('/profile')

        const metadata = await validateListingPhotoMetadata(
            admin,
            member.userId,
            claim.listingId,
        )

        if (metadata.state === 'error') {
            return { success: false, error: metadata.error }
        }

        if (metadata.state === 'gone') {
            const orphanCleanup = await removeAllListingPhotos(
                admin,
                member.userId,
                claim.listingId,
            )

            if (!orphanCleanup.success) {
                return orphanCleanup
            }

            const missingRowConfirmation = await readOwnedListingState(
                admin,
                member.userId,
                claim.listingId,
            )

            if (missingRowConfirmation.error || missingRowConfirmation.data) {
                return {
                    success: false,
                    error: createDeletionError(
                        'DELETE_CONFIRMATION_FAILED',
                        'The listing service could not confirm whether deletion finished. Refresh My Listings and try again.',
                        true,
                    ),
                }
            }

            revalidatePath('/profile')
            return { success: true }
        }
    }

    const canonicalListingId = claim.listingId
    const photosRemoved = await removeAllListingPhotos(
        admin,
        member.userId,
        canonicalListingId,
    )

    if (!photosRemoved.success) {
        return photosRemoved
    }

    if (claim.state === 'gone') {
        const current = await readOwnedListingState(
            admin,
            member.userId,
            canonicalListingId,
        )

        if (current.error || current.data) {
            return {
                success: false,
                error: createDeletionError(
                    'DELETE_CONFIRMATION_FAILED',
                    'The listing service could not confirm whether deletion finished. Refresh My Listings and try again.',
                    true,
                ),
            }
        }

        revalidatePath('/profile')
        return { success: true }
    }

    const rowDeleted = await deleteAndConfirmListingRow(
        admin,
        member.userId,
        canonicalListingId,
    )

    if (rowDeleted.success) {
        revalidatePath('/profile')
    }

    return rowDeleted
}
