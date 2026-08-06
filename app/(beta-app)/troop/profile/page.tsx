// app/troop/profile.page.tsx
import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaBottomNav } from '@/components/beta-bottom-nav'

async function ProfileContent() {
    await requireMember()

    return (
        <>
            <h1 className="mb-3 text-3xl font-semibold text-[#30392d]">Profile</h1>
            <p className="max-w-md text-[#625f58]">
                This is coming soon — check back shortly.
            </p>
        </>
    )
}

export default function ThoughtsPage() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#faf7f0] px-4 pb-28 text-center">
            <Suspense fallback={null}>
                <ProfileContent />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}