'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: boolean; error?: string }

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

export async function sendFriendRequest(addresseeId: string): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    if (userId === addresseeId) {
        return { success: false, error: 'You cannot add yourself.' }
    }

    // Check both directions — a relationship might already exist either way
    const { data: existing } = await db
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${userId})`)
        .maybeSingle()

    if (existing) {
        if (existing.status === 'accepted') {
            return { success: false, error: 'You are already friends.' }
        }
        return { success: false, error: 'A request already exists between you two.' }
    }

    const { error } = await db.from('friendships').insert({
        requester_id: userId,
        addressee_id: addresseeId,
        status: 'pending',
    })

    if (error) {
        return { success: false, error: 'Could not send the request. Please try again.' }
    }

    revalidatePath('/profile')
    return { success: true }
}

export async function acceptFriendRequest(friendshipId: string): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    // Only the addressee can accept — enforced here AND by RLS as a second layer
    const { data: updated, error } = await db
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

    if (error) {
        return { success: false, error: 'Could not accept the request. Please try again.' }
    }

    if (!updated) {
        return { success: false, error: 'This request no longer exists.' }
    }

    revalidatePath('/profile')
    return { success: true }
}

// Used for both declining (by the addressee) and cancelling (by the requester)
// — same operation, different caller, matching the "decline is silent" design.
export async function removeFriendship(friendshipId: string): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    const { error } = await db
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) {
        return { success: false, error: 'Could not complete this action. Please try again.' }
    }

    revalidatePath('/profile')
    return { success: true }
}