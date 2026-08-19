'use server'

import {
    getListingFeedPage,
    normalizeListingFeedCursor,
    type ListingFeedCursor,
    type ListingFeedResult,
} from '@/lib/listings/feed'
import { createClient } from '@/lib/supabase/server'

export async function getMoreListings(
    cursor: ListingFeedCursor,
): Promise<ListingFeedResult> {
    const normalizedCursor = normalizeListingFeedCursor(cursor)

    if (!normalizedCursor) {
        return { success: false, error: 'That page of listings is not available.' }
    }

    const db = await createClient()
    const { data: { user }, error: authError } = await db.auth.getUser()

    if (authError || !user) {
        return { success: false, error: 'Sign in again to keep browsing listings.' }
    }

    const { data: member, error: memberError } = await db
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

    if (memberError || !member) {
        return {
            success: false,
            error: 'Your troop membership could not be verified. Refresh and try again.',
        }
    }

    return getListingFeedPage(db, user.id, normalizedCursor)
}
