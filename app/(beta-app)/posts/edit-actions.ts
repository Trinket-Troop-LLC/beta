'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getJpegDimensions, getVerifiedImageExtension } from '@/lib/validate-image'
import {
    buildFieldErrors,
    getListingConstraintFailure,
    getText,
    listingDraftSchema,
    parsePriceCents,
} from '@/lib/listings/posting-fields'

const listingPhotosBucket = 'listing-photos'
const maxListingPhotoBytes = 5 * 1024 * 1024
const maxListingPhotoDimension = 4096
const maxListingPhotoPixels = 16_000_000
const maxPhotoCount = 5

type FieldErrors = Record<string, string>
type SimpleResult = { success: true } | { success: false; error?: string; fieldErrors?: FieldErrors }

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { userId: user?.id ?? null }
}

async function loadOwnedListing(admin: ReturnType<typeof createAdminClient>, listingId: string, userId: string) {
    const { data: listing } = await admin
        .from('listings')
        .select('id, status')
        .eq('id', listingId)
        .eq('owner_id', userId)
        .maybeSingle()

    return listing
}

export async function updateListingDetails(listingId: unknown, formData: FormData): Promise<SimpleResult> {
    const idValidation = z.string().uuid().safeParse(listingId)
    if (!idValidation.success) {
        return { success: false, error: 'This listing could not be found.' }
    }

    const { userId } = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    const admin = createAdminClient()
    const listing = await loadOwnedListing(admin, idValidation.data, userId)

    if (!listing) {
        return { success: false, error: 'This listing could not be found.' }
    }
    if (listing.status === 'draft') {
        return { success: false, error: 'This listing is still being posted. Finish posting it before editing.' }
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
        nuance: getText(formData, 'nuance'),
    })

    if (!validationFields.success) {
        return {
            success: false,
            error: 'Some details need to be corrected.',
            fieldErrors: buildFieldErrors(validationFields.error),
        }
    }

    const fields = validationFields.data
    const isForSale = fields.transaction_types.includes('sell')

    const { error } = await admin
        .from('listings')
        .update({
            title: fields.title,
            description: fields.description,
            category: fields.category,
            other_category: fields.category === 'other' ? fields.other_category : null,
            condition: fields.condition,
            transaction_types: fields.transaction_types,
            price_cents: isForSale ? parsePriceCents(fields.price) : null,
            pickup_area: fields.pickup_area,
            nuance: fields.nuance || null,
        })
        .eq('id', idValidation.data)
        .eq('owner_id', userId)

    if (error) {
        console.warn('Listing edit failed:', error.code)
        const constraint = getListingConstraintFailure(error)

        if (constraint) {
            return { success: false, error: constraint.message, fieldErrors: { [constraint.field]: constraint.message } }
        }

        return { success: false, error: 'Could not save your changes. Please try again.' }
    }

    revalidatePath(`/troop/listings/${idValidation.data}`)
    revalidatePath('/profile')
    return { success: true }
}

function generatePhotoPath(userId: string, listingId: string) {
    return `${userId}/${listingId}/${crypto.randomUUID()}.jpg`
}

type UpdatePhotosResult =
    | { success: true; newPhotoPaths: string[] }
    | { success: false; error: string }

// Repositions kept photos and reserves storage slots for new ones in a
// single pass: `listing_photos.position` is unique per listing, so
// reassigning positions one row at a time can transiently collide with a
// position another row still holds. Deleting every row for this listing and
// reinserting the kept ones (their storage_path is unchanged, so nothing is
// re-uploaded) alongside freshly reserved rows for the new photos sidesteps
// that entirely.
export async function updateListingPhotos(
    listingId: unknown,
    keepPhotoIds: unknown,
    newPhotoCount: unknown,
): Promise<UpdatePhotosResult> {
    const idValidation = z.string().uuid().safeParse(listingId)
    if (!idValidation.success) {
        return { success: false, error: 'This listing could not be found.' }
    }

    const keepIdsValidation = z.array(z.string().uuid()).safeParse(keepPhotoIds)
    if (!keepIdsValidation.success) {
        return { success: false, error: 'Could not read the current photo selection. Refresh and try again.' }
    }

    const countValidation = z.number().int().min(0).max(maxPhotoCount).safeParse(newPhotoCount)
    if (!countValidation.success) {
        return { success: false, error: `Choose no more than ${maxPhotoCount} photos in total.` }
    }

    const { userId } = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    const admin = createAdminClient()
    const listing = await loadOwnedListing(admin, idValidation.data, userId)

    if (!listing) {
        return { success: false, error: 'This listing could not be found.' }
    }
    if (listing.status === 'draft') {
        return { success: false, error: 'This listing is still being posted. Finish posting it before editing.' }
    }

    const { data: currentPhotos, error: currentError } = await admin
        .from('listing_photos')
        .select('id, storage_path')
        .eq('listing_id', idValidation.data)

    if (currentError) {
        console.warn('Could not load current listing photos:', currentError.code)
        return { success: false, error: 'Could not load the current photos. Please try again.' }
    }

    const currentById = new Map((currentPhotos ?? []).map((photo) => [photo.id, photo.storage_path]))
    const keepIds = [...new Set(keepIdsValidation.data)]

    if (!keepIds.every((id) => currentById.has(id))) {
        return { success: false, error: 'One of the selected photos no longer exists. Refresh and try again.' }
    }

    if (keepIds.length + countValidation.data > maxPhotoCount) {
        return { success: false, error: `Choose no more than ${maxPhotoCount} photos in total.` }
    }

    const removedPaths = (currentPhotos ?? [])
        .filter((photo) => !keepIds.includes(photo.id))
        .map((photo) => photo.storage_path)

    const { error: deleteError } = await admin
        .from('listing_photos')
        .delete()
        .eq('listing_id', idValidation.data)

    if (deleteError) {
        console.warn('Could not clear listing photos for edit:', deleteError.code)
        return { success: false, error: 'Could not update photos. Please try again.' }
    }

    if (removedPaths.length > 0) {
        const { error: removeError } = await admin.storage.from(listingPhotosBucket).remove(removedPaths)
        if (removeError) {
            console.warn('Could not remove dropped listing photos from storage:', removeError.statusCode)
        }
    }

    const newPhotoPaths = Array.from(
        { length: countValidation.data },
        () => generatePhotoPath(userId, idValidation.data),
    )

    const rowsToInsert = [
        ...keepIds.map((id, index) => ({
            listing_id: idValidation.data,
            storage_path: currentById.get(id)!,
            position: index,
        })),
        ...newPhotoPaths.map((path, index) => ({
            listing_id: idValidation.data,
            storage_path: path,
            position: keepIds.length + index,
        })),
    ]

    if (rowsToInsert.length > 0) {
        const { error: insertError } = await admin.from('listing_photos').insert(rowsToInsert)

        if (insertError) {
            console.warn('Could not save listing photo order:', insertError.code)
            return { success: false, error: 'Could not update photos. Please try again.' }
        }
    }

    revalidatePath(`/troop/listings/${idValidation.data}`)
    revalidatePath('/profile')
    return { success: true, newPhotoPaths }
}

async function cleanupNewPhotos(admin: ReturnType<typeof createAdminClient>, paths: string[]) {
    if (paths.length === 0) return
    await admin.from('listing_photos').delete().in('storage_path', paths)
    const { error } = await admin.storage.from(listingPhotosBucket).remove(paths)
    if (error) {
        console.warn('Could not clean up rejected listing photos:', error.statusCode)
    }
}

// Runs the same checks finalizeListing runs on brand-new photos (real file,
// correct type/size/dimensions) against photos just uploaded to the slots
// updateListingPhotos reserved. All-or-nothing: if any of the new photos
// fails, every new photo from this batch is dropped rather than leaving a
// partially-verified, inconsistently-positioned set -- the kept photos
// updateListingPhotos already committed are untouched either way.
export async function verifyListingPhotoEdit(listingId: unknown, newPhotoPaths: unknown): Promise<SimpleResult> {
    const idValidation = z.string().uuid().safeParse(listingId)
    if (!idValidation.success) {
        return { success: false, error: 'This listing could not be found.' }
    }

    const pathsValidation = z.array(z.string()).safeParse(newPhotoPaths)
    if (!pathsValidation.success || pathsValidation.data.length === 0) {
        return { success: true }
    }

    const { userId } = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    const admin = createAdminClient()
    const listing = await loadOwnedListing(admin, idValidation.data, userId)

    if (!listing) {
        return { success: false, error: 'This listing could not be found.' }
    }

    for (const path of pathsValidation.data) {
        const { data: photo, error: downloadError } = await admin.storage.from(listingPhotosBucket).download(path)

        if (downloadError || !photo) {
            console.warn('Listing edit photo download failed:', downloadError?.statusCode)
            await cleanupNewPhotos(admin, pathsValidation.data)
            return { success: false, error: 'One of your new photos did not finish uploading. Add it again.' }
        }

        if (photo.size > maxListingPhotoBytes || photo.type !== 'image/jpeg') {
            await cleanupNewPhotos(admin, pathsValidation.data)
            return { success: false, error: 'One of your new photos was invalid. Add it again.' }
        }

        const verifiedImage = await getVerifiedImageExtension(photo, maxListingPhotoBytes)
        if ('error' in verifiedImage || verifiedImage.extension !== 'jpg') {
            await cleanupNewPhotos(admin, pathsValidation.data)
            return { success: false, error: 'One of your new photos was damaged or invalid. Add it again.' }
        }

        const dimensions = await getJpegDimensions(photo)
        if (
            !dimensions
            || dimensions.width > maxListingPhotoDimension
            || dimensions.height > maxListingPhotoDimension
            || dimensions.width * dimensions.height > maxListingPhotoPixels
        ) {
            await cleanupNewPhotos(admin, pathsValidation.data)
            return { success: false, error: 'One of your new photos was too large. Choose a smaller image.' }
        }
    }

    revalidatePath(`/troop/listings/${idValidation.data}`)
    return { success: true }
}
