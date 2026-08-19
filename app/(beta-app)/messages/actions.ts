'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

async function findExistingConversation(
    db: Awaited<ReturnType<typeof getCurrentUserId>>['db'],
    userId: string,
    otherUserId: string
) {
    const { data } = await db
        .from('conversations')
        .select('id')
        .or(`and(participant_one_id.eq.${userId},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${userId})`)
        .maybeSingle()

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

    const existingId = await findExistingConversation(db, userId, otherUserId)
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

// Used when responding to a message board post — starts pending until accepted
export async function requestConversation(
    otherUserId: string,
    originId: string,
    firstMessageContent: string
) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const existingId = await findExistingConversation(db, userId, otherUserId)
    if (existingId) {
        const { error: messageError } = await db.from('messages').insert({
            conversation_id: existingId,
            sender_id: userId,
            content: firstMessageContent,
        })
        if (messageError) return { success: false, error: 'Could not send your message.' }
        revalidatePath('/messages')
        return { success: true, conversationId: existingId }
    }

    const { data: conversation, error: convError } = await db
        .from('conversations')
        .insert({
            participant_one_id: userId,
            participant_two_id: otherUserId,
            origin_type: 'message_board',
            origin_id: originId,
            status: 'pending',
            initiated_by: userId,
        })
        .select('id')
        .single()

    if (convError || !conversation) return { success: false, error: 'Could not start the conversation.' }

    const { error: messageError } = await db.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: userId,
        content: firstMessageContent,
    })
    if (messageError) return { success: false, error: 'Could not send your message.' }

    revalidatePath('/messages')
    return { success: true, conversationId: conversation.id }
}

export async function acceptConversationRequest(conversationId: string) {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in.' }

    const { data, error } = await db
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId)
        .eq('status', 'pending')
        .neq('initiated_by', userId)
        .select('id, origin_type, listing_id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not accept the request.' }
    if (!data) return { success: false, error: 'This request no longer exists.' }

    if (data.origin_type === 'offer' && data.listing_id) {
        const admin = createAdminClient()

        // Listings can only be written by the service role (see
        // supabase/migrations/20260810010000_enable_listing_posting.sql), so this
        // reservation has to go through the admin client rather than RLS.
        const { data: reserved, error: reserveError } = await admin
            .from('listings')
            .update({ status: 'reserved' })
            .eq('id', data.listing_id)
            .eq('status', 'active')
            .select('id')
            .maybeSingle()

        if (reserveError || !reserved) {
            // The listing was archived, deleted, or already reserved by another
            // accepted offer in a race. Roll the conversation back rather than
            // leaving it 'active' against a listing that was never reserved.
            await db
                .from('conversations')
                .update({ status: 'pending' })
                .eq('id', conversationId)
                .eq('status', 'active')

            return { success: false, error: 'This item is no longer available.' }
        }

        // A listing can only be reserved by one accepted offer at a time, so
        // decline every other pending request on it.
        await db
            .from('conversations')
            .delete()
            .eq('listing_id', data.listing_id)
            .eq('status', 'pending')
            .neq('id', conversationId)

        revalidatePath('/troop')
        revalidatePath('/profile')
        revalidatePath(`/troop/listings/${data.listing_id}`)
    }

    revalidatePath('/messages')
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