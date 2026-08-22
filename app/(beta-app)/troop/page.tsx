import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaOnboardingModal } from '@/components/beta-onboarding-modal'
import { getListingsView } from './actionts'
import { TroopFeed } from './troop-feed'

async function TroopHomeContent() {
    await requireMember()
    const result = await getListingsView(null)

    return (
        <div className="mx-auto w-full max-w-4xl text-left">
            {result.success ? (
                <TroopFeed initialListings={result.listings} initialCursor={result.nextCursor} />
            ) : (
                <p className="text-sm text-muted-foreground">{result.error}</p>
            )}
        </div>
    )
}

export default function TroopHome() {
    return (
        <main className="relative min-h-screen bg-background px-4 py-10 pb-44">
            <BetaOnboardingModal />
            <Suspense fallback={null}>
                <TroopHomeContent />
            </Suspense>
        </main>
    )
}
