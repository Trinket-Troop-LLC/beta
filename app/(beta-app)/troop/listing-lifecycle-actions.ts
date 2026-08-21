'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { createNotification } from '@/lib/notifications/create'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
    return typeof value === 'string' && uuidPattern.test(value)
}

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

type OfferableListing = { id: string; title: string; coverPhotoUrl: string | null }

export type SentPendingListingOffer = {
    offerId: string
    createdAt: string
    updatedAt: string
    targetListing: { id: string; title: string }
    targetOwner: { id: string; username: string; profilePictureUrl: string | null }
    offeredListing: { id: string; title: string; coverPhotoUrl: string | null }
}

// The buyer's own active listings, to pick from when offering a trade.
export async function getMyOfferableListings(excludeListingId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false as const, error: 'You must be logged in.' }

    const { data: listingRows, error } = await db
        .from('listings')
        .select('id, title')
        .eq('owner_id', userId)
        .eq('status', 'active')
        .contains('transaction_types', ['trade'])
        .neq('id', excludeListingId)
        .order('created_at', { ascending: false })

    if (error) return { success: false as const, error: 'Could not load your listings.' }

    const listingIds = listingRows.map((listing) => listing.id)
    const { data: coverPhotos } = listingIds.length > 0
        ? await db
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', listingIds)
            .eq('position', 0)
        : { data: [] }

    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedPhotos } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] }

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedUrlByPath = new Map(
        signedPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const listings: OfferableListing[] = listingRows.map((listing) => {
        const coverPath = coverPathByListingId.get(listing.id)
        return {
            id: listing.id,
            title: listing.title,
            coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
        }
    })

    return { success: true as const, listings }
}

// The pending trade offers on a listing, for its owner to review.
export async function getPendingOffersForListing(listingId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false as const, error: 'You must be logged in.' }

    const { data: offerRows, error } = await db
        .from('listing_offers')
        .select('id, offerer_id, offered_listing_id, created_at')
        .eq('listing_id', listingId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (error) return { success: false as const, error: 'Could not load offers.' }
    if (offerRows.length === 0) return { success: true as const, offers: [] }

    const offererIds = [...new Set(offerRows.map((offer) => offer.offerer_id))]
    const offeredListingIds = offerRows.map((offer) => offer.offered_listing_id)

    const [{ data: offerers }, { data: offeredListings }, { data: coverPhotos }] = await Promise.all([
        db.from('users').select('id, username, responses').in('id', offererIds),
        db.from('listings').select('id, title').in('id', offeredListingIds),
        db.from('listing_photos').select('listing_id, storage_path').in('listing_id', offeredListingIds).eq('position', 0),
    ])

    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedPhotos } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] }

    const avatarPaths = offerers?.map((offerer) => offerer.responses?.profile_picture_path) ?? []
    const avatarUrlByPath = await signProfilePictureUrls(db, avatarPaths)

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedUrlByPath = new Map(
        signedPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const offers = offerRows.map((offer) => {
        const offerer = offerers?.find((row) => row.id === offer.offerer_id)
        const offeredListing = offeredListings?.find((row) => row.id === offer.offered_listing_id)
        const coverPath = coverPathByListingId.get(offer.offered_listing_id)
        const avatarPath = offerer?.responses?.profile_picture_path

        return {
            offerId: offer.id,
            offerer: {
                id: offer.offerer_id,
                username: offerer?.username ?? 'Unknown',
                profilePictureUrl: (avatarPath && avatarUrlByPath.get(avatarPath)) ?? null,
            },
            offeredListing: {
                id: offer.offered_listing_id,
                title: offeredListing?.title ?? 'A listing',
                coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
            },
        }
    })

    return { success: true as const, offers }
}

// Pending trade offers sent by the current member. Reads use the service
// client only after authentication and always scope the offer query to the
// caller, which also lets stale target rows remain renderable if their normal
// member visibility changed after the offer was sent.
export async function getMySentPendingOffers() {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false as const, error: 'You must be logged in.' }

    const admin = createAdminClient()
    const { data: offerRows, error: offersError } = await admin
        .from('listing_offers')
        .select('id, listing_id, offered_listing_id, created_at, updated_at')
        .eq('offerer_id', userId)
        .eq('status', 'pending')
        .order('updated_at', { ascending: false })

    if (offersError) return { success: false as const, error: 'Could not load your sent offers.' }
    if (!offerRows || offerRows.length === 0) {
        return { success: true as const, offers: [] as SentPendingListingOffer[] }
    }

    const targetListingIds = [...new Set(offerRows.map((offer) => offer.listing_id))]
    const offeredListingIds = [...new Set(offerRows.map((offer) => offer.offered_listing_id))]

    const [targetListingsResult, offeredListingsResult, coverPhotosResult] = await Promise.all([
        admin
            .from('listings')
            .select('id, owner_id, title')
            .in('id', targetListingIds),
        admin
            .from('listings')
            .select('id, title')
            .in('id', offeredListingIds),
        admin
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', offeredListingIds)
            .eq('position', 0),
    ])

    if (targetListingsResult.error || offeredListingsResult.error) {
        return { success: false as const, error: 'Could not load the listings for your sent offers.' }
    }

    const targetListings = targetListingsResult.data ?? []
    const offeredListings = offeredListingsResult.data ?? []
    const targetOwnerIds = [...new Set(targetListings.map((listing) => listing.owner_id))]
    const { data: targetOwners, error: targetOwnersError } = await admin
        .from('users')
        .select('id, username, responses')
        .in('id', targetOwnerIds)

    if (targetOwnersError) {
        return { success: false as const, error: 'Could not load the members for your sent offers.' }
    }

    const coverPhotos = coverPhotosResult.data ?? []
    const coverPaths = coverPhotos.map((photo) => photo.storage_path)
    const { data: signedPhotos } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] }
    const avatarPaths = targetOwners?.map((owner) => owner.responses?.profile_picture_path) ?? []
    const avatarUrlByPath = await signProfilePictureUrls(db, avatarPaths)

    const targetListingById = new Map(targetListings.map((listing) => [listing.id, listing]))
    const targetOwnerById = new Map(targetOwners?.map((owner) => [owner.id, owner]) ?? [])
    const offeredListingById = new Map(offeredListings.map((listing) => [listing.id, listing]))
    const coverPathByListingId = new Map(
        coverPhotos.map((photo) => [photo.listing_id, photo.storage_path]),
    )
    const signedUrlByPath = new Map(
        signedPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const hasMissingRelatedRow = offerRows.some((offer) => {
        const targetListing = targetListingById.get(offer.listing_id)
        return !targetListing
            || !targetOwnerById.has(targetListing.owner_id)
            || !offeredListingById.has(offer.offered_listing_id)
    })

    if (hasMissingRelatedRow) {
        return { success: false as const, error: 'One or more sent offers could not be loaded.' }
    }

    const offers: SentPendingListingOffer[] = offerRows.map((offer) => {
        const targetListing = targetListingById.get(offer.listing_id)!
        const targetOwner = targetOwnerById.get(targetListing.owner_id)!
        const offeredListing = offeredListingById.get(offer.offered_listing_id)!
        const avatarPath = targetOwner.responses?.profile_picture_path
        const coverPath = coverPathByListingId.get(offeredListing.id)

        return {
            offerId: offer.id,
            createdAt: offer.created_at,
            updatedAt: offer.updated_at,
            targetListing: {
                id: targetListing.id,
                title: targetListing.title,
            },
            targetOwner: {
                id: targetOwner.id,
                username: targetOwner.username ?? 'Unknown',
                profilePictureUrl: (avatarPath && avatarUrlByPath.get(avatarPath)) ?? null,
            },
            offeredListing: {
                id: offeredListing.id,
                title: offeredListing.title,
                coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
            },
        }
    })

    return { success: true as const, offers }
}

// Listing writes go through the admin client throughout this file (see
// 20260810010000_enable_listing_posting.sql) -- authenticated clients can
// only read listings/listing_offers directly, never mutate them. Ownership
// and state are enforced here in application code via explicit .eq() checks
// instead.

// A trade reserves two listings as one transaction (see acceptListingOffer).
// Given either side, finds the other, so markListingFulfilled/unreserveListing
// (and deleteListing, in profile/listing-actions.ts) can move both together
// instead of leaving one stuck reserved. Ordered by most recent since a
// listing can be reserved-then-released-then-reserved again across separate
// accepted offers over its lifetime, and only the current pairing matters.
// Returns null for a sell/gift listing, which never has an accepted
// listing_offers row at all.
export async function findPairedTradeListingId(
    admin: ReturnType<typeof createAdminClient>,
    listingId: string,
): Promise<string | null> {
    const { data } = await admin
        .from('listing_offers')
        .select('listing_id, offered_listing_id')
        .eq('status', 'accepted')
        .or(`listing_id.eq.${listingId},offered_listing_id.eq.${listingId}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!data) return null
    return data.listing_id === listingId ? data.offered_listing_id : data.listing_id
}

export async function submitListingOffer(targetListingId: string, offeredListingId: string) {
    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    if (targetListingId === offeredListingId) {
        return { success: false, error: 'You cannot offer a listing for itself.' }
    }

    const admin = createAdminClient()

    const { data: offeredListing } = await admin
        .from('listings')
        .select('id, transaction_types')
        .eq('id', offeredListingId)
        .eq('owner_id', userId)
        .eq('status', 'active')
        .maybeSingle()

    if (!offeredListing) {
        return { success: false, error: 'That listing is no longer available to offer.' }
    }

    if (!offeredListing.transaction_types.includes('trade')) {
        return { success: false, error: 'That listing is not available for trade.' }
    }

    const { data: targetListing } = await admin
        .from('listings')
        .select('id, owner_id, status, transaction_types')
        .eq('id', targetListingId)
        .maybeSingle()

    if (!targetListing || targetListing.status !== 'active') {
        return { success: false, error: 'This listing is no longer available.' }
    }
    if (targetListing.owner_id === userId) {
        return { success: false, error: 'You cannot offer on your own listing.' }
    }
    if (!targetListing.transaction_types.includes('trade')) {
        return { success: false, error: 'This listing is not accepting trades.' }
    }

    const { error } = await admin
        .from('listing_offers')
        .insert({
            listing_id: targetListingId,
            offered_listing_id: offeredListingId,
            offerer_id: userId,
        })

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'You already have a pending offer on this listing.' }
        }
        return { success: false, error: 'Could not send your offer. Please try again.' }
    }

    await createNotification({
        recipientId: targetListing.owner_id,
        type: 'listing_interest',
        actorId: userId,
        relatedListingId: targetListingId,
    })

    revalidatePath(`/troop/listings/${targetListingId}`)
    revalidatePath('/messages')
    return { success: true }
}

export async function updatePendingListingOffer(offerId: string, offeredListingId: string) {
    if (!isUuid(offerId) || !isUuid(offeredListingId)) {
        return { success: false, error: 'This offer update is invalid.' }
    }

    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()
    const { data: offer, error: offerError } = await admin
        .from('listing_offers')
        .select('id, listing_id, offered_listing_id, offerer_id, status, updated_at')
        .eq('id', offerId)
        .eq('offerer_id', userId)
        .eq('status', 'pending')
        .maybeSingle()

    if (offerError) return { success: false, error: 'Could not load this offer. Please try again.' }
    if (!offer) return { success: false, error: 'This offer is no longer available to edit.' }
    if (offer.listing_id === offeredListingId) {
        return { success: false, error: 'You cannot offer a listing for itself.' }
    }

    const [targetListingResult, replacementListingResult] = await Promise.all([
        admin
            .from('listings')
            .select('id, owner_id, status, transaction_types')
            .eq('id', offer.listing_id)
            .maybeSingle(),
        admin
            .from('listings')
            .select('id, owner_id, status, transaction_types')
            .eq('id', offeredListingId)
            .maybeSingle(),
    ])

    if (targetListingResult.error || replacementListingResult.error) {
        return { success: false, error: 'Could not verify the listings for this offer.' }
    }

    const targetListing = targetListingResult.data
    const replacementListing = replacementListingResult.data
    const targetIsTradeable = targetListing
        && targetListing.owner_id !== userId
        && targetListing.status === 'active'
        && targetListing.transaction_types.includes('trade')
    const replacementIsTradeable = replacementListing
        && replacementListing.owner_id === userId
        && replacementListing.status === 'active'
        && replacementListing.transaction_types.includes('trade')

    if (!targetIsTradeable) {
        return { success: false, error: 'The requested listing is no longer available for trade.' }
    }
    if (!replacementIsTradeable) {
        return { success: false, error: 'Choose one of your active trade listings.' }
    }

    // updated_at is a version token maintained by the listing-offer trigger.
    // If acceptance, withdrawal, or another edit wins the race, this update
    // matches no row instead of overwriting that newer state.
    const { data: updatedOffer, error: updateError } = await admin
        .from('listing_offers')
        .update({ offered_listing_id: offeredListingId })
        .eq('id', offer.id)
        .eq('listing_id', offer.listing_id)
        .eq('offered_listing_id', offer.offered_listing_id)
        .eq('offerer_id', userId)
        .eq('status', 'pending')
        .eq('updated_at', offer.updated_at)
        .select('id')
        .maybeSingle()

    if (updateError) return { success: false, error: 'Could not update this offer. Please try again.' }
    if (!updatedOffer) return { success: false, error: 'This offer changed before it could be updated.' }

    revalidatePath(`/troop/listings/${offer.listing_id}`)
    revalidatePath('/messages')
    return { success: true }
}

export async function withdrawPendingListingOffer(offerId: string) {
    if (!isUuid(offerId)) return { success: false, error: 'This offer is invalid.' }

    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()
    const { data: withdrawnOffer, error } = await admin
        .from('listing_offers')
        .update({ status: 'withdrawn' })
        .eq('id', offerId)
        .eq('offerer_id', userId)
        .eq('status', 'pending')
        .select('id, listing_id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not withdraw this offer. Please try again.' }
    if (!withdrawnOffer) return { success: false, error: 'This offer is no longer available to withdraw.' }

    revalidatePath(`/troop/listings/${withdrawnOffer.listing_id}`)
    revalidatePath('/messages')
    return { success: true }
}

export async function acceptListingOffer(offerId: string) {
    if (!isUuid(offerId)) return { success: false, error: 'This offer is invalid.' }

    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()

    const { data: offer, error: offerError } = await admin
        .from('listing_offers')
        .select('listing_id')
        .eq('id', offerId)
        .maybeSingle()

    if (offerError) return { success: false, error: 'Could not load this offer. Please try again.' }
    if (!offer) return { success: false, error: 'This offer is no longer available.' }

    // The RPC claims the offer, reserves both listings, and activates the
    // conversation inside one PostgreSQL transaction. Concurrent edits,
    // withdrawals, and acceptances therefore cannot leave partial state.
    const { data: conversationId, error: acceptError } = await admin.rpc(
        'accept_pending_listing_offer',
        {
            p_offer_id: offerId,
            p_owner_id: userId,
        },
    )

    if (acceptError || !conversationId) {
        return {
            success: false,
            error: 'This offer changed or one of its listings is no longer available for trade.',
        }
    }

    revalidatePath(`/troop/listings/${offer.listing_id}`)
    revalidatePath('/messages')

    return { success: true, conversationId }
}

export async function declineListingOffer(offerId: string) {
    if (!isUuid(offerId)) return { success: false, error: 'This offer is invalid.' }

    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()

    const { data: offer, error: offerError } = await admin
        .from('listing_offers')
        .select('id, listing_id, offered_listing_id, offerer_id, status, updated_at')
        .eq('id', offerId)
        .maybeSingle()

    if (offerError) return { success: false, error: 'Could not load this offer. Please try again.' }
    if (!offer || offer.status !== 'pending') {
        return { success: false, error: 'This offer is no longer available.' }
    }

    const { data: targetListing } = await admin
        .from('listings')
        .select('id, owner_id')
        .eq('id', offer.listing_id)
        .maybeSingle()

    if (!targetListing || targetListing.owner_id !== userId) {
        return { success: false, error: 'You are not the owner of this listing.' }
    }

    const { data: declinedOffer, error } = await admin
        .from('listing_offers')
        .update({ status: 'declined' })
        .eq('id', offer.id)
        .eq('listing_id', offer.listing_id)
        .eq('offered_listing_id', offer.offered_listing_id)
        .eq('offerer_id', offer.offerer_id)
        .eq('status', 'pending')
        .eq('updated_at', offer.updated_at)
        .select('id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not decline this offer. Please try again.' }
    if (!declinedOffer) return { success: false, error: 'This offer changed before it could be declined.' }

    revalidatePath(`/troop/listings/${offer.listing_id}`)
    revalidatePath('/messages')
    return { success: true }
}

export async function markListingFulfilled(listingId: string) {
    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('listings')
        .update({ status: 'fulfilled', active_transaction_type: null })
        .eq('id', listingId)
        .eq('owner_id', userId)
        .eq('status', 'reserved')
        .select('id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not update this listing. Please try again.' }
    if (!data) return { success: false, error: 'This listing is not reserved right now.' }

    // A trade reserves two listings as one transaction -- close out both.
    const pairedListingId = await findPairedTradeListingId(admin, listingId)
    if (pairedListingId) {
        await admin
            .from('listings')
            .update({ status: 'fulfilled', active_transaction_type: null })
            .eq('id', pairedListingId)
            .eq('status', 'reserved')
        revalidatePath(`/troop/listings/${pairedListingId}`)
    }

    // other listings that were part of this exchange that didn't get accepted
    const relatedListingIds = pairedListingId ? [listingId, pairedListingId] : [listingId]
    await admin
        .from('conversations')
        .update({ status: 'closed'})
        .in('origin_id', relatedListingIds)
        .in('origin_type', ['listing', 'offer'])
        .eq('status', 'pending')

    await admin
        .from('listing_offers')
        .update({ status: 'declined' })
        .in('listing_id', relatedListingIds)
        .eq('status', 'pending')


    // close the linked conversation now that the transaction is done --
    // covers both trade offers ('offer') and direct sell/gift requests
    // ('listing'), which are the two origin types that link to a listing.
    const { data: closedConversations, error: closeConversationError } = await admin
        .from('conversations')
        .update({ status: 'closed', closed_reason: 'fulfilled' })
        .in('origin_type', ['offer', 'listing'])
        .in('origin_id', pairedListingId ? [listingId, pairedListingId] : [listingId])
        .eq('status', 'active')
        .select('id, participant_one_id, participant_two_id')

    if (closeConversationError) {
        console.error('Could not close conversation for fulfilled listing:', closeConversationError)
    }

    // Prompt both sides to review the exchange: the other participant gets
    // notified now, and the caller (who just marked it complete) is sent
    // straight into the review flow by the returned conversation id.
    const exchangeConversation = closedConversations?.[0] ?? null
    if (exchangeConversation) {
        const otherUserId = exchangeConversation.participant_one_id === userId
            ? exchangeConversation.participant_two_id
            : exchangeConversation.participant_one_id

        await createNotification({
            recipientId: otherUserId,
            type: 'exchange_complete_review_prompt',
            actorId: userId,
            relatedConversationId: exchangeConversation.id,
            relatedListingId: listingId,
        })
    }

    revalidatePath(`/troop/listings/${listingId}`)
    revalidatePath('/messages')
    revalidatePath('/profile')
    return { success: true, reviewConversationId: exchangeConversation?.id ?? null }
}

export async function unreserveListing(listingId: string) {
    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('listings')
        .update({ status: 'active', active_transaction_type: null })
        .eq('id', listingId)
        .eq('owner_id', userId)
        .eq('status', 'reserved')
        .select('id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not update this listing. Please try again.' }
    if (!data) return { success: false, error: 'This listing is not reserved right now.' }

    // A trade reserves two listings as one transaction -- release both.
    const pairedListingId = await findPairedTradeListingId(admin, listingId)
    if (pairedListingId) {
        await admin
            .from('listings')
            .update({ status: 'active', active_transaction_type: null })
            .eq('id', pairedListingId)
            .eq('status', 'reserved')
        revalidatePath(`/troop/listings/${pairedListingId}`)
    }

    // close the linked conversation now that this deal fell through --
    // otherwise it stays 'active' and a later accepted offer/request on this
    // listing would create a second active conversation for the same listing.
    // Covers both trade offers ('offer') and direct sell/gift requests
    // ('listing'), which are the two origin types that link to a listing.
    const { data: closedConversations, error: closeConversationError } = await admin
        .from('conversations')
        .update({ status: 'closed', closed_reason: 'cancelled' })
        .in('origin_type', ['offer', 'listing'])
        .in('origin_id', pairedListingId ? [listingId, pairedListingId] : [listingId])
        .eq('status', 'active')
        .select('id, participant_one_id, participant_two_id')

    if (closeConversationError) {
        console.error('Could not close conversation for unreserved listing:', closeConversationError)
    }

    for (const conversation of closedConversations ?? []) {
        const otherUserId = conversation.participant_one_id === userId
            ? conversation.participant_two_id
            : conversation.participant_one_id

        await createNotification({
            recipientId: otherUserId,
            type: 'exchange_cancelled',
            actorId: userId,
            relatedConversationId: conversation.id,
            relatedListingId: listingId,
        })
    }

    revalidatePath(`/troop/listings/${listingId}`)
    revalidatePath('/messages')
    revalidatePath('/profile')
    return { success: true }
}

// Ends a lend reservation once the item is back. Unlike markListingFulfilled
// (sell/gift/trade -- always terminal), a lend can go back out again, so the
// owner chooses whether to relist it or take it off their profile. Only
// valid while active_transaction_type is 'lend' -- sell/gift/trade
// reservations use markListingFulfilled/unreserveListing instead.
export async function markListingReturned(listingId: string, action: 'relist' | 'remove') {
    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('listings')
        .update({
            status: action === 'relist' ? 'active' : 'archived',
            active_transaction_type: null,
        })
        .eq('id', listingId)
        .eq('owner_id', userId)
        .eq('status', 'reserved')
        .eq('active_transaction_type', 'lend')
        .select('id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not update this listing. Please try again.' }
    if (!data) return { success: false, error: 'This listing is not currently out on loan.' }

    // The loan with this borrower is over either way -- close the linked
    // conversation, same as markListingFulfilled does for sell/gift/trade.
    // Lending has no paired listing (that's a trade-only concept). Either
    // outcome (relist or remove) means the loan itself concluded normally,
    // so both count as review-eligible, same as a sell/gift/trade fulfillment.
    const { data: closedConversations, error: closeConversationError } = await admin
        .from('conversations')
        .update({ status: 'closed', closed_reason: 'fulfilled' })
        .eq('origin_type', 'listing')
        .eq('origin_id', listingId)
        .eq('status', 'active')
        .select('id, participant_one_id, participant_two_id')

    if (closeConversationError) {
        console.error('Could not close conversation for returned listing:', closeConversationError)
    }

    // Prompt both sides to review the loan, same as markListingFulfilled.
    const exchangeConversation = closedConversations?.[0] ?? null
    if (exchangeConversation) {
        const otherUserId = exchangeConversation.participant_one_id === userId
            ? exchangeConversation.participant_two_id
            : exchangeConversation.participant_one_id

        await createNotification({
            recipientId: otherUserId,
            type: 'exchange_complete_review_prompt',
            actorId: userId,
            relatedConversationId: exchangeConversation.id,
            relatedListingId: listingId,
        })
    }

    revalidatePath(`/troop/listings/${listingId}`)
    revalidatePath('/messages')
    revalidatePath('/profile')
    return { success: true, reviewConversationId: exchangeConversation?.id ?? null }
}

// All pending trade offers across every listing the current user owns,
// for a consolidated "Offers" view (vs. getPendingOffersForListing, which
// is scoped to a single listing's detail page).
export async function getAllMyPendingOffers() {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false as const, error: 'You must be logged in.' }

    const { data: myListingRows, error: myListingsError } = await db
        .from('listings')
        .select('id, title')
        .eq('owner_id', userId)

    if (myListingsError) return { success: false as const, error: 'Could not load your listings.' }
    if (!myListingRows || myListingRows.length === 0) return { success: true as const, offers: [] }

    const myListingIds = myListingRows.map((listing) => listing.id)
    const myListingTitleById = new Map(myListingRows.map((listing) => [listing.id, listing.title]))

    const { data: offerRows, error: offersError } = await db
        .from('listing_offers')
        .select('id, listing_id, offerer_id, offered_listing_id, created_at')
        .in('listing_id', myListingIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

    if (offersError) return { success: false as const, error: 'Could not load offers.' }
    if (offerRows.length === 0) return { success: true as const, offers: [] }

    const offererIds = [...new Set(offerRows.map((offer) => offer.offerer_id))]
    const offeredListingIds = offerRows.map((offer) => offer.offered_listing_id)

    const [{ data: offerers }, { data: offeredListings }, { data: coverPhotos }] = await Promise.all([
        db.from('users').select('id, username, responses').in('id', offererIds),
        db.from('listings').select('id, title').in('id', offeredListingIds),
        db.from('listing_photos').select('listing_id, storage_path').in('listing_id', offeredListingIds).eq('position', 0),
    ])

    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedPhotos } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] }

    const avatarPaths = offerers?.map((offerer) => offerer.responses?.profile_picture_path) ?? []
    const avatarUrlByPath = await signProfilePictureUrls(db, avatarPaths)

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedUrlByPath = new Map(
        signedPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const offers = offerRows.map((offer) => {
        const offerer = offerers?.find((row) => row.id === offer.offerer_id)
        const offeredListing = offeredListings?.find((row) => row.id === offer.offered_listing_id)
        const coverPath = coverPathByListingId.get(offer.offered_listing_id)
        const avatarPath = offerer?.responses?.profile_picture_path

        return {
            offerId: offer.id,
            createdAt: offer.created_at,
            targetListing: {
                id: offer.listing_id,
                title: myListingTitleById.get(offer.listing_id) ?? 'A listing',
            },
            offerer: {
                id: offer.offerer_id,
                username: offerer?.username ?? 'Unknown',
                profilePictureUrl: (avatarPath && avatarUrlByPath.get(avatarPath)) ?? null,
            },
            offeredListing: {
                id: offer.offered_listing_id,
                title: offeredListing?.title ?? 'A listing',
                coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
            },
        }
    })

    return { success: true as const, offers }
}
