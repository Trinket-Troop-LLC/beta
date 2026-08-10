import { Suspense } from 'react'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { requireMember } from '@/lib/supabase/require-member'
import { ListingForm } from './listing-form'

async function PostsContent() {
    await requireMember()

    return (
        <div className="mx-auto w-full max-w-2xl">
            <header className="mb-7 text-left">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                    Share a trinket
                </p>
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Make a post</h1>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
                    Tell the troop what you&apos;re passing along. You can sell it, trade it, gift it, or choose more than one.
                </p>
            </header>

            <ListingForm />
        </div>
    )
}

export default function PostsPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-10 pb-32 sm:px-6">
            <Suspense fallback={null}>
                <PostsContent />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}
