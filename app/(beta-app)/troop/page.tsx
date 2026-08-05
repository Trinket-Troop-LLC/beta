import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaOnboardingModal } from '@/components/beta-onboarding-modal'
import { BetaBottomNav } from '@/components/beta-bottom-nav'

async function TroopHomeContent() {
    const { profile } = await requireMember()

    return (
        <>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#e4e8d8] px-4 py-2 text-sm font-medium text-[#5f7258]">
                You&apos;re in
            </p>
            <h1 className="mb-3 text-4xl font-semibold text-[#30392d] sm:text-5xl">
                Welcome{profile.username ? `, ${profile.username}` : ''}
            </h1>
            <p className="max-w-md text-[#625f58]">
                The troop is still getting set up — posting, browsing, and messaging are on their way. Check back soon.
            </p>
        </>
    )
}

export default function TroopHome() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#faf7f0] px-4 pb-28 text-center">
            <BetaOnboardingModal />
            <Suspense fallback={null}>
                <TroopHomeContent />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}
