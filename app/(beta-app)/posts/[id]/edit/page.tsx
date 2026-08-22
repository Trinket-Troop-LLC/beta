import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { requireMember } from '@/lib/supabase/require-member'
import { Skeleton } from '@/components/ui/skeleton'
import { EditListingForm } from './edit-listing-form'

async function EditListingContent({ listingId }: { listingId: string }) {
    const { db, user } = await requireMember()

    const { data: listing } = await db
        .from('listings')
        .select('id, owner_id, title, description, category, other_category, nuance, condition, transaction_types, price_cents, pickup_area, status')
        .eq('id', listingId)
        .maybeSingle()

    if (!listing || listing.owner_id !== user.id) {
        notFound()
    }

    // Drafts are still mid-creation (see posts/actions.ts) and aren't
    // reachable from anywhere that would link here -- send them back to
    // finish that flow instead of half-supporting edits on an unpublished row.
    if (listing.status === 'draft') {
        redirect('/posts')
    }

    const { data: photoRows } = await db
        .from('listing_photos')
        .select('id, storage_path')
        .eq('listing_id', listingId)
        .order('position', { ascending: true })

    const photoPaths = photoRows?.map((photo) => photo.storage_path) ?? []
    const { data: signedPhotos } = photoPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(photoPaths, 3600)
        : { data: [] }

    const signedUrlByPath = new Map(signedPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [])
    const photos = (photoRows ?? []).map((photo) => ({
        id: photo.id,
        url: signedUrlByPath.get(photo.storage_path) ?? null,
    }))

    return (
        <div className="mx-auto w-full max-w-2xl">
            <header className="mb-7 text-left">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                    Edit listing
                </p>
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{listing.title}</h1>
            </header>

            <EditListingForm
                listingId={listing.id}
                initialValues={{
                    title: listing.title,
                    description: listing.description,
                    category: listing.category,
                    other_category: listing.other_category ?? '',
                    nuance: listing.nuance ?? '',
                    condition: listing.condition,
                    transaction_types: listing.transaction_types,
                    price: listing.price_cents !== null ? (listing.price_cents / 100).toFixed(2) : '',
                    pickup_area: listing.pickup_area,
                }}
                initialPhotos={photos}
            />
        </div>
    )
}

function EditListingSkeleton() {
    return (
        <div className="mx-auto w-full max-w-2xl">
            <div className="mb-7 text-left">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-9 w-56" />
            </div>
            <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
    )
}

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    return (
        <main className="min-h-screen bg-background px-4 py-10 pb-32 sm:px-6">
            <Suspense fallback={<EditListingSkeleton />}>
                <EditListingContent listingId={id} />
            </Suspense>
        </main>
    )
}
