// app/troop/thoughts/page.tsx
import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaBottomNav } from '@/components/beta-bottom-nav'

async function ThoughtsContent() {
    await requireMember()

    return (
        <>
            <h1 className="mb-3 text-3xl font-semibold text-foreground">Thoughts</h1>
            <p className="max-w-md text-muted-foreground">
                This is coming soon — check back shortly.
            </p>
        </>
    )
}

export default function ThoughtsPage() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 pb-28 text-center">
            <Suspense fallback={null}>
                <ThoughtsContent />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}