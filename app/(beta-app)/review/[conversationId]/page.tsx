import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/supabase/require-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { BetaAppChrome } from '@/components/beta-app-chrome'
import { ReviewForm } from './review-form'

async function ReviewContent({ conversationId }: { conversationId: string }) {
    const { db, user } = await requireMember()

    const { data: conversation } = await db
        .from('conversations')
        .select('id, participant_one_id, participant_two_id, origin_type, origin_id')
        .eq('id', conversationId)
        .maybeSingle()

    if (!conversation) notFound()

    const isParticipant = conversation.participant_one_id === user.id || conversation.participant_two_id === user.id
    if (!isParticipant) notFound()

    if (!(conversation.origin_type === 'offer' || conversation.origin_type === 'listing') || !conversation.origin_id) {
        notFound()
    }

    const otherUserId = conversation.participant_one_id === user.id
        ? conversation.participant_two_id
        : conversation.participant_one_id

    // Fetched via the admin client, not `db`: once the listing is fulfilled,
    // the "Members view available listings or their own" RLS policy only
    // lets its owner read it (status is no longer 'active'/'reserved'), so
    // the *other* participant -- who this page is equally meant to serve --
    // would otherwise get null back here and see a false "not complete yet".
    // Participation is already verified above, so this doesn't leak access.
    const admin = createAdminClient()
    const [{ data: listing }, { data: otherProfile }, { data: existingReview }] = await Promise.all([
        admin.from('listings').select('id, title, status').eq('id', conversation.origin_id).maybeSingle(),
        db.from('users').select('username').eq('id', otherUserId).maybeSingle(),
        db.from('exchange_reviews').select('rating').eq('conversation_id', conversationId).eq('reviewer_id', user.id).maybeSingle(),
    ])

    const revieweeUsername = otherProfile?.username ?? 'this person'

    return (
        <div className="w-full max-w-md">
            <h1 className="mb-2 text-2xl font-semibold text-[#30392d]">Review the exchange</h1>

            {listing?.status !== 'fulfilled' ? (
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4">
                    <p className="text-sm text-[#625f58]">This exchange isn&apos;t marked complete yet.</p>
                </div>
            ) : existingReview ? (
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4">
                    <p className="text-sm text-[#625f58]">
                        You already reviewed @{revieweeUsername} for this exchange. Thanks!
                    </p>
                </div>
            ) : (
                <ReviewForm
                    conversationId={conversationId}
                    revieweeUsername={revieweeUsername}
                    listingTitle={listing.title ?? null}
                />
            )}
        </div>
    )
}

export default async function ReviewPage({ params }: { params: Promise<{ conversationId: string }> }) {
    const { conversationId } = await params

    return (
        <main className="relative flex min-h-screen flex-col items-center bg-[#faf7f0] px-4 pb-28 pt-12">
            <Suspense fallback={null}>
                <ReviewContent conversationId={conversationId} />
            </Suspense>
            <BetaAppChrome />
        </main>
    )
}
