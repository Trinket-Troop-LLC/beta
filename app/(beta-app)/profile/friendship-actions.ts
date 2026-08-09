'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: boolean; error?: string }

export type SearchResult = {
    id: string
    username: string
    profilePictureUrl: string | null
    relationship: 'friend' | 'sent' | 'received' | 'none'
    friendshipId: string | null
}


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

export async function searchUsers(query: string): Promise<{ success: true; results: SearchResult[] } | { success: false; error: string }> {
    const { db, userId } = await getCurrentUserId()

    if (!userId) {
        return { success: false, error: 'You must be logged in.' }
    }

    const trimmed = query.trim()

    if (trimmed.length === 0) {
        return { success: true, results: [] }
    }

    const { data: matchedUsers, error: matchError } = await db
        .from('users')
        .select('id, username, responses')
        .ilike('username', `${trimmed}%`)
        .neq('id', userId)
        .limit(20)

    if (matchError) {
        return { success: false, error: 'Could not search right now. Please try again.' }
    }

    if (!matchedUsers || matchedUsers.length === 0) {
        return { success: true, results: [] }
    }

    const matchedIds = matchedUsers.map((u) => u.id)

    const { data: relatedFriendships } = await db
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .or(`requester_id.in.(${matchedIds.join(',')}),addressee_id.in.(${matchedIds.join(',')})`)

    const paths = matchedUsers.map((u) => u.responses?.profile_picture_path).filter((path): path is string => Boolean(path))

    const { data: signedUrlResults } = paths.length > 0
        ? await db.storage.from('beta-profile-pictures').createSignedUrls(paths, 3600)
        : { data: [] }

    const results: SearchResult[] = matchedUsers.map((matched) => {
        const path = matched.responses?.profile_picture_path
        const pictureMatch = signedUrlResults?.find((r) => r.path === path)

        const relatedRow = relatedFriendships?.find((row) =>
            (row.requester_id === userId && row.addressee_id === matched.id) ||
            (row.addressee_id === userId && row.requester_id === matched.id)
        )

        let relationship: SearchResult['relationship'] = 'none'
        if (relatedRow) {
            if (relatedRow.status === 'accepted') {
                relationship = 'friend'
            } else if (relatedRow.requester_id === userId) {
                relationship = 'sent'
            } else {
                relationship = 'received'
            }
        }

        return {
            id: matched.id,
            username: matched.username,
            profilePictureUrl: pictureMatch?.signedUrl ?? null,
            relationship,
            friendshipId: relatedRow?.id ?? null,
        }
    })

    // Friends first, 
    results.sort((a, b) => {
        if (a.relationship === 'friend' && b.relationship !== 'friend') return -1
        if (b.relationship === 'friend' && a.relationship !== 'friend') return 1
        return a.username.localeCompare(b.username)
    })

    return { success: true, results }
}