'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

type RequestListingOfferResult =
    | { success: true; conversationId: string }
    | { success: false; error: string }

const requestSchema = z.object({
    listingId: z.string().uuid(),
    offeredListingId: z.string().uuid().nullable(),
    message: z.string().trim().max(2000, 'Keep the message to 2,000 characters or fewer.'),
})

export async function requestListingOffer(
    listingId: unknown,
    offeredListingId: unknown,
    message: unknown,
): Promise<RequestListingOfferResult> {
    const parsed = requestSchema.safeParse({ listingId, offeredListingId, message })

    if (!parsed.success) {
        return { success: false, error: 'This offer could not be sent. Refresh the page and try again.' }
    }

    const { listingId: targetListingId, offeredListingId: offeredId, message: trimmedMessage } = parsed.data

    if (!offeredId && !trimmedMessage) {
        return {
            success: false,
            error: 'Write a message, or choose one of your own listings to offer instead.',
        }
    }

    const db = await createClient()
    const { data: { user }, error: authError } = await db.auth.getUser()

    if (authError || !user) {
        return { success: false, error: 'Sign in again before sending an offer.' }
    }

    const { data: member, error: memberError } = await db
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

    if (memberError || !member) {
        return { success: false, error: 'Your troop membership could not be verified. Refresh and try again.' }
    }

    const { data: targetListing, error: targetListingError } = await db
        .from('listings')
        .select('id, owner_id, status')
        .eq('id', targetListingId)
        .maybeSingle()

    if (targetListingError) {
        return { success: false, error: 'This listing could not be checked right now. Try again shortly.' }
    }

    if (!targetListing || targetListing.status !== 'active') {
        return { success: false, error: 'This listing is no longer available for an offer.' }
    }

    if (targetListing.owner_id === user.id) {
        return { success: false, error: 'You cannot make an offer on your own listing.' }
    }

    if (offeredId) {
        const { data: offeredListing, error: offeredListingError } = await db
            .from('listings')
            .select('id, owner_id, status')
            .eq('id', offeredId)
            .maybeSingle()

        if (offeredListingError) {
            return { success: false, error: 'The listing you offered could not be checked right now. Try again shortly.' }
        }

        if (!offeredListing || offeredListing.owner_id !== user.id || offeredListing.status !== 'active') {
            return { success: false, error: 'You can only offer one of your own active listings.' }
        }
    }

    // Reuse an existing conversation about this specific listing between these two
    // people, rather than the generic participant-pair lookup used elsewhere — two
    // people can have separate conversations about different listings.
    const { data: existingConversation, error: existingConversationError } = await db
        .from('conversations')
        .select('id, status')
        .eq('listing_id', targetListingId)
        .or(`and(participant_one_id.eq.${user.id},participant_two_id.eq.${targetListing.owner_id}),and(participant_one_id.eq.${targetListing.owner_id},participant_two_id.eq.${user.id})`)
        .maybeSingle()

    if (existingConversationError) {
        return { success: false, error: 'This offer could not be sent right now. Try again shortly.' }
    }

    if (existingConversation) {
        return { success: true, conversationId: existingConversation.id }
    }

    const { data: conversation, error: conversationError } = await db
        .from('conversations')
        .insert({
            participant_one_id: user.id,
            participant_two_id: targetListing.owner_id,
            origin_type: 'offer',
            origin_id: targetListingId,
            listing_id: targetListingId,
            offered_listing_id: offeredId,
            status: 'pending',
            initiated_by: user.id,
        })
        .select('id')
        .single()

    if (conversationError || !conversation) {
        return { success: false, error: 'Could not send your offer. Please try again.' }
    }

    if (trimmedMessage) {
        const { error: messageError } = await db.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: user.id,
            content: trimmedMessage,
        })

        if (messageError) {
            return { success: false, error: 'Your offer was sent, but the message could not be delivered.' }
        }
    }

    revalidatePath('/messages')
    revalidatePath(`/troop/listings/${targetListingId}`)

    return { success: true, conversationId: conversation.id }
}
