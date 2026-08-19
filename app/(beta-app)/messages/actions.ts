'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reserveListing } from '@/app/(beta-app)/troop/listing-reservation'
import { revalidatePath } from 'next/cache'
import type { ListingTransactionType } from '@/lib/listings/domain'

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

async function findExistingConversation(
    db: Awaited<ReturnType<typeof getCurrentUserId>>['db'],
    userId: string,
    otherUserId: string,
    originType: string,
    originId: string | null,
) {
    let query = db
        .from('conversations')
        .select('id')
        .or(`and(participant_one_id.eq.${userId},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${userId})`)
        .neq('status', 'closed')
        .eq('origin_type', originType)

    // Listings/offers/bulletin posts each get their own thread per origin.
    // A truly origin-less "direct" conversation still reuses one thread per
    // person, since there's nothing more specific to scope it to.
    if (originId) {
        query = query.eq('origin_id', originId)
    } else {
        query = query.is('origin_id', null)
    }

    const { data } = await query.maybeSingle()
    return data?.id ?? null
}

// Used when a conversation should start immediately usable (e.g. an accepted offer)
export async function startActiveConversation(
    otherUserId: string,
    originType: 'offer' | 'direct',
    originId: string | null
) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const existingId = await findExistingConversation(db, userId, otherUserId, originType, originId)
    if (existingId) {
        await db.from('conversations').update({ status: 'active' }).eq('id', existingId)
        return { success: true, conversationId: existingId }
    }

    const { data, error } = await db
        .from('conversations')
        .insert({
            participant_one_id: userId,
            participant_two_id: otherUserId,
            origin_type: originType,
            origin_id: originId,
            status: 'active',
            initiated_by: userId,
        })
        .select('id')
        .single()

    if (error || !data) return { success: false, error: 'Could not start the conversation.' }

    return { success: true, conversationId: data.id }
}

// Used when responding to a message board post, or requesting a sell/gift/
// lend listing — starts pending until accepted. transactionType is only
// meaningful for originType 'listing' — it's carried through to
// acceptConversationRequest, which stamps it onto the listing as the
// reservation actually happens.
export async function requestConversation(
    otherUserId: string,
    originId: string,
    firstMessageContent: string,
    originType: 'message_board' | 'listing' = 'message_board',
    transactionType?: ListingTransactionType,
) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    // Unlike submitListingOffer, this used to skip re-checking listing status
    // at creation time -- a client could still request a listing that had
    // just been reserved (the page-render gate only hides the button).
    if (originType === 'listing') {
        const admin = createAdminClient()
        const { data: listing } = await admin
            .from('listings')
            .select('id, status')
            .eq('id', originId)
            .maybeSingle()

        if (!listing || listing.status !== 'active') {
            return { success: false, error: 'This listing is no longer available.' }
        }
    }

    const trimmedMessage = firstMessageContent.trim()

    const existingId = await findExistingConversation(db, userId, otherUserId, originType, originId)
    if (existingId) {
        if (trimmedMessage) {
            const { error: messageError } = await db.from('messages').insert({
                conversation_id: existingId,
                sender_id: userId,
                content: trimmedMessage,
            })
            if (messageError) return { success: false, error: 'Could not send your message.' }
        }
        revalidatePath('/messages')
        return { success: true, conversationId: existingId }
    }

    const { data: conversation, error: convError } = await db
        .from('conversations')
        .insert({
            participant_one_id: userId,
            participant_two_id: otherUserId,
            origin_type: originType,
            origin_id: originId,
            transaction_type: transactionType ?? null,
            status: 'pending',
            initiated_by: userId,
        })
        .select('id')
        .single()

    if (convError || !conversation) {
        // 23505 = the unique index added in
        // 20260816000000_add_conversation_uniqueness_constraints.sql caught a
        // duplicate request created concurrently with this one (e.g. a
        // double-click) -- findExistingConversation's check-then-insert above
        // isn't itself race-proof.
        if (convError?.code === '23505') {
            return { success: false, error: 'You already have a pending request for this.' }
        }
        return { success: false, error: 'Could not start the conversation.' }
    }

    if (trimmedMessage) {
        const { error: messageError } = await db.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: userId,
            content: trimmedMessage,
        })
        if (messageError) return { success: false, error: 'Could not send your message.' }
    }

    revalidatePath('/messages')
    return { success: true, conversationId: conversation.id }
}

export async function acceptConversationRequest(conversationId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const admin = createAdminClient()

    const { data: conversation } = await db
        .from('conversations')
        .select('id, origin_type, origin_id, transaction_type')
        .eq('id', conversationId)
        .eq('status', 'pending')
        .neq('initiated_by', userId)
        .maybeSingle()

    if (!conversation) return { success: false, error: 'This conversation request no longer exists.'}

    // for buy / sell / loan requests, don't allow accepting a second request
    // if there's already a active conversation; i.e listing is reserved.
    // This must happen before the conversation is flipped to 'active' below --
    // otherwise a failed reservation would still leave the conversation active.
    // Stamping active_transaction_type here (not just status) is what lets
    // the owner's completion UI later tell a lend apart from a sell/gift on
    // a listing that offers several types at once.
    const isListingRequest = conversation.origin_type === 'listing' && conversation.origin_id !== null
    if (isListingRequest) {
        const reserved = await reserveListing(admin, conversation.origin_id!, userId)
        if (!reserved) {
            return { success: false, error: 'An active conversation about this listing already exists. Mark it as fell through before accepting another request.'}
        }
        await admin
            .from('listings')
            .update({ active_transaction_type: conversation.transaction_type ?? null })
            .eq('id', conversation.origin_id!)
    }

    await db
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId)

    revalidatePath('/messages')
    revalidatePath('/troop')
    return { success: true }
}

export async function declineConversationRequest(conversationId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const { error } = await db
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('status', 'pending')

    if (error) return { success: false, error: 'Could not decline the request.' }

    revalidatePath('/messages')
    return { success: true }
}

export async function sendMessage(conversationId: string, content: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const trimmed = content.trim()
    if (!trimmed) return { success: false, error: 'Message cannot be empty.' }

    const { data, error } = await db
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: userId,
            content: trimmed,
        })
        .select()
        .single()

    if (error || !data) return { success: false, error: 'Could not send message. This conversation may not be active yet.' }

    revalidatePath('/messages')
    return { success: true, message: data }
}