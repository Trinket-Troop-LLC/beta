'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { startActiveConversation } from '@/app/(beta-app)/messages/actions'
import { reserveListing, releaseListing } from '@/app/(beta-app)/troop/listing-reservation'

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

type OfferableListing = { id: string; title: string; coverPhotoUrl: string | null }

// The buyer's own active listings, to pick from when offering a trade.
export async function getMyOfferableListings(excludeListingId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false as const, error: 'You must be logged in.' }

    const { data: listingRows, error } = await db
        .from('listings')
        .select('id, title')
        .eq('owner_id', userId)
        .eq('status', 'active')
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
        .select('id')
        .eq('id', offeredListingId)
        .eq('owner_id', userId)
        .eq('status', 'active')
        .maybeSingle()

    if (!offeredListing) {
        return { success: false, error: 'That listing is no longer available to offer.' }
    }

    const { data: targetListing } = await admin
        .from('listings')
        .select('id, owner_id, status')
        .eq('id', targetListingId)
        .maybeSingle()

    if (!targetListing || targetListing.status !== 'active') {
        return { success: false, error: 'This listing is no longer available.' }
    }
    if (targetListing.owner_id === userId) {
        return { success: false, error: 'You cannot offer on your own listing.' }
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

    revalidatePath(`/troop/listings/${targetListingId}`)
    return { success: true }
}

export async function acceptListingOffer(offerId: string) {
    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()

    const { data: offer } = await admin
        .from('listing_offers')
        .select('id, listing_id, offered_listing_id, offerer_id, status')
        .eq('id', offerId)
        .maybeSingle()

    if (!offer || offer.status !== 'pending') {
        return { success: false, error: 'This offer is no longer available.' }
    }

    const { data: targetListing } = await admin
        .from('listings')
        .select('id, owner_id, status')
        .eq('id', offer.listing_id)
        .maybeSingle()

    if (!targetListing || targetListing.owner_id !== userId) {
        return { success: false, error: 'You are not the owner of this listing.' }
    }

    if (targetListing.status !== 'active') {
        return { success: false, error: "This listing already has an ongoing conversation. If it didn't work out, close it before accepting another offer." }
    }

    // Accepting is mutual agreement -- both sides reserve immediately, via
    // the same reserveListing helper acceptConversationRequest uses, so a
    // listing that raced onto some other reservation in between can't be
    // silently double-booked here.
    const targetReserved = await reserveListing(admin, offer.listing_id, userId)
    if (!targetReserved) {
        return { success: false, error: 'Could not reserve this listing. Please try again.' }
    }

    const offeredReserved = await reserveListing(admin, offer.offered_listing_id)
    if (!offeredReserved) {
        await releaseListing(admin, offer.listing_id)
        return { success: false, error: 'The offered listing is no longer available. Ask them to send a new offer.' }
    }

    // A trade offer is unambiguously a trade, so active_transaction_type is
    // set directly here (no need to carry it through a request the way
    // sell/gift/lend do via conversations.transaction_type).
    await admin
        .from('listings')
        .update({ active_transaction_type: 'trade' })
        .in('id', [offer.listing_id, offer.offered_listing_id])

    // Start the conversation before marking the offer accepted, so a failure
    // here rolls back the reservation instead of leaving both listings stuck
    // reserved with an accepted offer and no conversation to show for it.
    const conversationResult = await startActiveConversation(offer.offerer_id, 'offer', offer.listing_id)

    if (!conversationResult.success) {
        await releaseListing(admin, offer.listing_id)
        await releaseListing(admin, offer.offered_listing_id)
        return { success: false, error: 'Could not start the conversation. Please try again.' }
    }

    await admin
        .from('listing_offers')
        .update({ status: 'accepted' })
        .eq('id', offer.id)

    // Other pending offers on this listing are left untouched — the owner
    // decides whether to decline them manually, or accept one later if this
    // trade falls through and the listing reopens.

    revalidatePath(`/troop/listings/${offer.listing_id}`)
    revalidatePath('/messages')

    return { success: true, conversationId: conversationResult.conversationId }
}

export async function declineListingOffer(offerId: string) {
    const { userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()

    const { data: offer } = await admin
        .from('listing_offers')
        .select('id, listing_id, status')
        .eq('id', offerId)
        .maybeSingle()

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

    const { error } = await admin
        .from('listing_offers')
        .update({ status: 'declined' })
        .eq('id', offerId)
        .eq('status', 'pending')

    if (error) return { success: false, error: 'Could not decline this offer. Please try again.' }

    revalidatePath(`/troop/listings/${offer.listing_id}`)
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
    const { error: closeConversationError } = await admin
        .from('conversations')
        .update({ status: 'closed' })
        .in('origin_type', ['offer', 'listing'])
        .in('origin_id', pairedListingId ? [listingId, pairedListingId] : [listingId])
        .eq('status', 'active')

    if (closeConversationError) {
        console.error('Could not close conversation for fulfilled listing:', closeConversationError)
    }

    revalidatePath(`/troop/listings/${listingId}`)
    revalidatePath('/messages')
    revalidatePath('/profile')
    return { success: true }
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
    const { error: closeConversationError } = await admin
        .from('conversations')
        .update({ status: 'closed' })
        .in('origin_type', ['offer', 'listing'])
        .in('origin_id', pairedListingId ? [listingId, pairedListingId] : [listingId])
        .eq('status', 'active')

    if (closeConversationError) {
        console.error('Could not close conversation for unreserved listing:', closeConversationError)
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
    // Lending has no paired listing (that's a trade-only concept).
    const { error: closeConversationError } = await admin
        .from('conversations')
        .update({ status: 'closed' })
        .eq('origin_type', 'listing')
        .eq('origin_id', listingId)
        .eq('status', 'active')

    if (closeConversationError) {
        console.error('Could not close conversation for returned listing:', closeConversationError)
    }

    revalidatePath(`/troop/listings/${listingId}`)
    revalidatePath('/messages')
    revalidatePath('/profile')
    return { success: true }
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