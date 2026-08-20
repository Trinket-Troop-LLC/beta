'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { success: boolean; error?: string }

// Placeholder review flow: 1-5 stars plus an optional comment. Reviews are
// only ever written here, via the admin client, after independently
// re-verifying the reviewer was a participant in a completed exchange --
// exchange_reviews has no insert policy for authenticated users.
export async function submitReview(conversationId: string, rating: number, comment: string): Promise<ActionResult> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { success: false, error: 'Choose a rating between 1 and 5 stars.' }
    }

    const trimmedComment = comment.trim()
    if (trimmedComment.length > 1000) {
        return { success: false, error: 'Keep your comment to 1000 characters or fewer.' }
    }

    const admin = createAdminClient()

    const { data: conversation } = await admin
        .from('conversations')
        .select('id, participant_one_id, participant_two_id, origin_type, origin_id')
        .eq('id', conversationId)
        .maybeSingle()

    if (!conversation) return { success: false, error: 'This exchange could not be found.' }

    const isParticipant = conversation.participant_one_id === user.id || conversation.participant_two_id === user.id
    if (!isParticipant) return { success: false, error: 'You were not part of this exchange.' }

    if (!(conversation.origin_type === 'offer' || conversation.origin_type === 'listing') || !conversation.origin_id) {
        return { success: false, error: 'This exchange cannot be reviewed.' }
    }

    const { data: listing } = await admin
        .from('listings')
        .select('id, status')
        .eq('id', conversation.origin_id)
        .maybeSingle()

    if (!listing || listing.status !== 'fulfilled') {
        return { success: false, error: 'This exchange is not complete yet.' }
    }

    const revieweeId = conversation.participant_one_id === user.id
        ? conversation.participant_two_id
        : conversation.participant_one_id

    const { error } = await admin.from('exchange_reviews').insert({
        conversation_id: conversationId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: trimmedComment || null,
    })

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'You already reviewed this exchange.' }
        }
        return { success: false, error: 'Could not submit your review. Please try again.' }
    }

    revalidatePath(`/review/${conversationId}`)
    return { success: true }
}
