'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { success: boolean; error?: string }

const allowedRatings = new Set([1, 3, 5])

// Reviews are only ever written here, via the admin client, after
// independently re-verifying the reviewer was a participant in the exact
// completed conversation. exchange_reviews deliberately has no insert policy
// for authenticated users.
export async function submitReview(
    conversationId: string,
    rating: number,
    experience: string,
    thankYouNote: string,
): Promise<ActionResult> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    if (!Number.isInteger(rating) || !allowedRatings.has(rating)) {
        return { success: false, error: 'Choose Sad, Mid, or Happy.' }
    }

    if (typeof experience !== 'string' || experience.length > 1000) {
        return { success: false, error: 'Keep your experience to 1000 characters or fewer.' }
    }
    if (typeof thankYouNote !== 'string' || thankYouNote.length > 1000) {
        return { success: false, error: 'Keep your thank you note to 1000 characters or fewer.' }
    }

    const trimmedExperience = experience.trim()
    const trimmedThankYouNote = thankYouNote.trim()
    const admin = createAdminClient()

    const { data: conversation } = await admin
        .from('conversations')
        .select('id, participant_one_id, participant_two_id, origin_type, origin_id, status, closed_reason')
        .eq('id', conversationId)
        .maybeSingle()

    if (!conversation) return { success: false, error: 'This exchange could not be found.' }

    const isParticipant = conversation.participant_one_id === user.id || conversation.participant_two_id === user.id
    if (!isParticipant) return { success: false, error: 'You were not part of this exchange.' }

    if (!(conversation.origin_type === 'offer' || conversation.origin_type === 'listing') || !conversation.origin_id) {
        return { success: false, error: 'This exchange cannot be reviewed.' }
    }

    if (conversation.status !== 'closed' || conversation.closed_reason !== 'fulfilled') {
        return { success: false, error: 'This exchange is not complete yet.' }
    }

    const { data: listing } = await admin
        .from('listings')
        .select('id')
        .eq('id', conversation.origin_id)
        .maybeSingle()

    if (!listing) {
        return { success: false, error: 'This exchange cannot be reviewed.' }
    }

    const revieweeId = conversation.participant_one_id === user.id
        ? conversation.participant_two_id
        : conversation.participant_one_id

    const { error } = await admin.from('exchange_reviews').insert({
        conversation_id: conversationId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating,
        comment: trimmedExperience || null,
        thank_you_note: trimmedThankYouNote || null,
    })

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'You already reviewed this exchange.' }
        }
        return { success: false, error: 'Could not submit your review. Please try again.' }
    }

    revalidatePath(`/review/${conversationId}`)
    revalidatePath('/profile')
    revalidatePath('/profile/[username]', 'page')
    return { success: true }
}
