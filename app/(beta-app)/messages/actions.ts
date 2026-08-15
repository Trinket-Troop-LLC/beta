'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
        .neq('status', 'closed')
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

// Used when responding to a message board post, or requesting a sell/gift
// listing — starts pending until accepted
export async function requestConversation(
    otherUserId: string,
    originId: string,
    firstMessageContent: string,
    originType: 'message_board' | 'listing' = 'message_board'
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
            origin_type: originType,
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
        .select('id, origin_type, origin_id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not accept the request.' }
    if (!data) return { success: false, error: 'This request no longer exists.' }

    // Accepting a listing request is the moment of owner agreement — that's
    // when the listing actually reserves, not when the request was sent.
    // Listing writes go through the admin client (see
    // 20260810010000_enable_listing_posting.sql): authenticated clients can't
    // mutate listings directly.
    if (data.origin_type === 'listing' && data.origin_id) {
        const admin = createAdminClient()
        await admin
            .from('listings')
            .update({ status: 'reserved' })
            .eq('id', data.origin_id)
            .eq('owner_id', userId)
            .eq('status', 'active')
    }

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