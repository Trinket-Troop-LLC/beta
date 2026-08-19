import { createAdminClient } from '@/lib/supabase/admin'

// Atomically reserves a listing iff it's currently active, so two concurrent
// accepts (a trade offer and a message request, or two of either) can't both
// succeed. Shared by acceptListingOffer and acceptConversationRequest, which
// previously reimplemented this independently and had drifted out of sync.
export async function reserveListing(
    admin: ReturnType<typeof createAdminClient>,
    listingId: string,
    expectedOwnerId?: string,
): Promise<boolean> {
    let query = admin
        .from('listings')
        .update({ status: 'reserved' })
        .eq('id', listingId)
        .eq('status', 'active')

    if (expectedOwnerId) {
        query = query.eq('owner_id', expectedOwnerId)
    }

    const { data } = await query.select('id').maybeSingle()
    return !!data
}

// Reverts a reservation made by reserveListing, for when a later step in the
// same accept flow (e.g. starting the conversation) fails and the listing
// shouldn't be left stuck reserved.
export async function releaseListing(
    admin: ReturnType<typeof createAdminClient>,
    listingId: string,
): Promise<void> {
    await admin
        .from('listings')
        .update({ status: 'active' })
        .eq('id', listingId)
        .eq('status', 'reserved')
}
