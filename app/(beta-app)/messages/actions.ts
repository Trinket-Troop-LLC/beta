'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reserveListing } from '@/app/(beta-app)/troop/listing-reservation'
import { revalidatePath } from 'next/cache'
import type { ListingTransactionType } from '@/lib/listings/domain'
import { createNotification } from '@/lib/notifications/create'
import { sendPushNotification } from '@/lib/notifications/push-send'

const LISTING_REQUEST_TRANSACTION_TYPES = ['sell', 'gift', 'lend'] as const

type ListingRequestTransactionType = (typeof LISTING_REQUEST_TRANSACTION_TYPES)[number]

function isListingRequestTransactionType(
    value: unknown,
): value is ListingRequestTransactionType {
    return LISTING_REQUEST_TRANSACTION_TYPES.some((type) => type === value)
}

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
        .select('id, status')
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
    return data ?? null
}

// Used when a conversation should start immediately usable (e.g. an accepted offer)
export async function startActiveConversation(
    otherUserId: string,
    originType: 'offer' | 'direct',
    originId: string | null
) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const existing = await findExistingConversation(db, userId, otherUserId, originType, originId)
    if (existing) {
        await db.from('conversations').update({ status: 'active' }).eq('id', existing.id)
        return { success: true, conversationId: existing.id }
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

    let validatedTransactionType: ListingRequestTransactionType | null = null

    // Unlike submitListingOffer, this used to skip re-checking listing status
    // at creation time -- a client could still request a listing that had
    // just been reserved (the page-render gate only hides the button).
    if (originType === 'listing') {
        const admin = createAdminClient()
        const { data: listing } = await admin
            .from('listings')
            .select('id, owner_id, status, transaction_types')
            .eq('id', originId)
            .maybeSingle()

        if (!listing || listing.status !== 'active') {
            return { success: false, error: 'This listing is no longer available.' }
        }

        if (listing.owner_id === userId) {
            return { success: false, error: 'You cannot request your own listing.' }
        }

        if (listing.owner_id !== otherUserId) {
            return { success: false, error: 'This listing request could not be verified.' }
        }

        if (
            !isListingRequestTransactionType(transactionType)
            || !listing.transaction_types.includes(transactionType)
        ) {
            return { success: false, error: 'This listing does not offer that exchange option.' }
        }

        validatedTransactionType = transactionType
    }

    const existing = await findExistingConversation(db, userId, otherUserId, originType, originId)
    if (existing) {
        if (originType === 'listing') {
            // A member can revisit an active listing and choose a different
            // offered mode while their request is still pending. Update the
            // authoritative mode before appending the new message. Requiring
            // the current member to be the initiator prevents either party
            // from repurposing someone else's request. Requiring `pending`
            // also closes the race where the owner accepts between the listing
            // check above and this update: in that case we do not overwrite
            // the type that was just accepted.
            const { data: updatedConversation, error: updateError } = await db
                .from('conversations')
                .update({ transaction_type: validatedTransactionType })
                .eq('id', existing.id)
                .eq('status', 'pending')
                .eq('initiated_by', userId)
                .select('id')
                .maybeSingle()

            if (updateError) {
                return { success: false, error: 'Could not update your listing request.' }
            }

            if (!updatedConversation) {
                return { success: false, error: 'This listing request is no longer pending.' }
            }
        }

        const { error: messageError } = await db.from('messages').insert({
            conversation_id: existing.id,
            sender_id: userId,
            content: firstMessageContent,
        })
        if (messageError) return { success: false, error: 'Could not send your message.' }

        if (originType === 'listing') {
            await createNotification({
                recipientId: otherUserId,
                type: 'listing_interest',
                actorId: userId,
                relatedListingId: originId,
            })
        }

        revalidatePath('/messages')
        return { success: true, conversationId: existing.id }
    }

    const { data: conversation, error: convError } = await db
        .from('conversations')
        .insert({
            participant_one_id: userId,
            participant_two_id: otherUserId,
            origin_type: originType,
            origin_id: originId,
            transaction_type: validatedTransactionType,
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

    const { error: messageError } = await db.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: userId,
        content: firstMessageContent,
    })
    if (messageError) return { success: false, error: 'Could not send your message.' }

    if (originType === 'listing') {
        await createNotification({
            recipientId: otherUserId,
            type: 'listing_interest',
            actorId: userId,
            relatedListingId: originId,
        })
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

// A plain participant-initiated close -- no accept/decline, no listing
// transaction involved. Either side of an active conversation can end it;
// once closed, `findExistingConversation` won't reuse the thread, so a new
// message to the same person/origin starts a fresh request instead.
export async function closeConversation(conversationId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const { data: closed, error } = await db
        .from('conversations')
        .update({ status: 'closed', closed_reason: 'closed' })
        .eq('id', conversationId)
        .eq('status', 'active')
        .or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`)
        .select('id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not end this conversation.' }
    if (!closed) return { success: false, error: 'This conversation could not be found.' }

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

    // Unread messages get a push notification and a badge count (see
    // markMessagesRead/getUnreadMessageCount), but deliberately never a row
    // in `notifications` -- that list is for discrete events, not every
    // message in an open-ended chat.
    const { data: conversation } = await db
        .from('conversations')
        .select('participant_one_id, participant_two_id')
        .eq('id', conversationId)
        .maybeSingle()

    if (conversation) {
        const recipientId = conversation.participant_one_id === userId
            ? conversation.participant_two_id
            : conversation.participant_one_id

        const { data: sender } = await db.from('users').select('username').eq('id', userId).maybeSingle()
        const preview = trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed

        await sendPushNotification(recipientId, {
            title: sender?.username ? `New message from @${sender.username}` : 'New message',
            body: preview,
            url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/messages/${conversationId}`,
        })
    }

    revalidatePath('/messages')
    return { success: true, message: data }
}

// Marks every message in a conversation not sent by the caller as read --
// called when the caller opens/is viewing that conversation. Drives the
// unread badge on the Messages tab (see lib/messages/get-unread-count.ts).
export async function markMessagesRead(conversationId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const { error } = await db
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .is('read_at', null)

    if (error) return { success: false, error: 'Could not mark messages read.' }
    return { success: true }
}
