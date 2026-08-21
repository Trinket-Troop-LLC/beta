import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaOnboardingModal } from '@/components/beta-onboarding-modal'
import { getListingFeedPage } from '@/lib/listings/feed'
import { TroopFeed } from './troop-feed'

async function TroopHomeContent() {
    const { db, profile } = await requireMember()
    const result = await getListingFeedPage(db, null)

    return (
        <div className="mx-auto w-full max-w-5xl">
            <header className="mb-7 text-left sm:mb-9">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                    The troop&apos;s shelf
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
                    Hi{profile.username ? `, @${profile.username}` : ''}. See what&apos;s being shared.
                </h1>
                <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
                    Fresh finds from the troop, newest first — including your own.
                </p>
            </header>

            {result.success ? (
                <TroopFeed
                    initialListings={result.listings}
                    initialCursor={result.nextCursor}
                    initialHasPartialMediaError={result.hasPartialMediaError}
                />
            ) : (
                <p
                    className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4 text-sm text-destructive"
                    role="alert"
                >
                    {result.error}
                </p>
            )}
        </div>
    )
}

function TroopHomeSkeleton() {
    return (
        <div className="mx-auto w-full max-w-5xl animate-pulse" aria-hidden="true">
            <div className="mb-9 space-y-3">
                <div className="h-4 w-32 rounded-full bg-secondary" />
                <div className="h-10 w-full max-w-xl rounded-xl bg-secondary" />
                <div className="h-5 w-full max-w-2xl rounded-lg bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                    <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="aspect-square bg-secondary" />
                        <div className="space-y-2 p-4">
                            <div className="h-4 rounded bg-secondary" />
                            <div className="h-3 w-2/3 rounded bg-secondary" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function TroopHome() {
    return (
        <main className="relative min-h-screen bg-background px-4 py-10 pb-48 sm:px-6">
            <BetaOnboardingModal />
            <Suspense fallback={<TroopHomeSkeleton />}>
                <TroopHomeContent />
            </Suspense>
        </main>
    )
}
