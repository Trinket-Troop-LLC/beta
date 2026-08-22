import 'server-only'
import type { ProfileThankYouNote } from '@/components/profile/thank-you-notes'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Profile pages intentionally use a service-role query because thank-you notes
 * are public profile content while the rest of each review is private. Keep
 * this projection narrow so ratings and experience comments never cross the
 * server-component boundary.
 */
export async function getProfileThankYouNotes(profileId: string): Promise<ProfileThankYouNote[]> {
    const admin = createAdminClient()
    const { data: reviewRows, error: reviewsError } = await admin
        .from('exchange_reviews')
        .select('id, reviewer_id, thank_you_note, created_at')
        .eq('reviewee_id', profileId)
        .not('thank_you_note', 'is', null)
        .order('created_at', { ascending: false, nullsFirst: false })

    if (reviewsError) {
        console.warn('Profile thank-you notes query failed:', reviewsError.code)
        return []
    }

    const notes = (reviewRows ?? []).filter(
        (row): row is typeof row & { thank_you_note: string } => (
            typeof row.thank_you_note === 'string' && row.thank_you_note.trim().length > 0
        ),
    )
    if (notes.length === 0) return []

    const reviewerIds = [...new Set(notes.map((note) => note.reviewer_id))]
    const { data: reviewers, error: reviewersError } = await admin
        .from('users')
        .select('id, username')
        .in('id', reviewerIds)

    if (reviewersError) {
        console.warn('Thank-you note attribution query failed:', reviewersError.code)
        return []
    }

    const usernameById = new Map(
        (reviewers ?? []).map((reviewer) => [reviewer.id, reviewer.username]),
    )

    return notes.flatMap((note) => {
        const reviewerUsername = usernameById.get(note.reviewer_id)
        if (!reviewerUsername) return []

        return [{
            id: note.id,
            note: note.thank_you_note,
            reviewerUsername,
            createdAt: note.created_at,
        }]
    })
}
