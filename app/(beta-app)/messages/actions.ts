'use server'

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
        .select('id')
        .maybeSingle()

    if (error) return { success: false, error: 'Could not accept the request.' }
    if (!data) return { success: false, error: 'This request no longer exists.' }

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

    const { error } = await db.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: trimmed,
    })

    if (error) return { success: false, error: 'Could not send message. This conversation may not be active yet.' }

    revalidatePath('/messages')
    return { success: true }
}