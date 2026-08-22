import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { Skeleton } from '@/components/ui/skeleton'
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
                    Tell the troop what you&apos;re passing along. You can sell it, trade it, gift it, lend it out, or choose more than one.
                </p>
            </header>

            <ListingForm />
        </div>
    )
}

function PostsSkeleton() {
    return (
        <div className="mx-auto w-full max-w-2xl">
            <div className="mb-7 text-left">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="mb-3 h-9 w-56" />
                <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
    )
}

export default function PostsPage() {
    return (
        <main className="flex-1 px-4 py-10 pb-44 sm:px-6">
            <Suspense fallback={<PostsSkeleton />}>
                <PostsContent />
            </Suspense>
        </main>
    )
}
