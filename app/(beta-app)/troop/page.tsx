import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaOnboardingModal } from '@/components/beta-onboarding-modal'
import { getListingsView } from './actionts'
import { TroopFeed } from './troop-feed'

async function TroopHomeContent() {
    const { profile } = await requireMember()
    const result = await getListingsView(null)

    return (
        <div className="mx-auto w-full max-w-4xl text-left">
            <h1 className="mb-4 text-3xl font-semibold text-[#30392d]">
                Welcome{profile.username ? `, ${profile.username}` : ''}
            </h1>

            {result.success ? (
                <TroopFeed initialListings={result.listings} initialCursor={result.nextCursor} />
            ) : (
                <p className="text-sm text-[#625f58]">{result.error}</p>
            )}
        </div>
    )
}

export default function TroopHome() {
    return (
        <main className="relative min-h-screen bg-[#faf7f0] px-4 py-10 pb-32">
            <BetaOnboardingModal />
            <Suspense fallback={null}>
                <TroopHomeContent />
            </Suspense>
        </main>
    )
}
