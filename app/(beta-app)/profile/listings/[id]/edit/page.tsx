import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { BetaAppChrome } from '@/components/beta-app-chrome'
import { requireMember } from '@/lib/supabase/require-member'
import {
    LISTING_STATUS_LABELS,
    type ListingCategory,
    type ListingCondition,
    type ListingStatus,
    type ListingTransactionType,
} from '@/lib/listings/domain'
import { EditListingForm, type EditableListingDetails } from './edit-listing-form'

async function EditListingContent({ listingId }: { listingId: string }) {
    const { db, user } = await requireMember()
    const { data: listing, error } = await db
        .from('listings')
        .select('id, title, description, category, other_category, condition, transaction_types, price_cents, pickup_area, status')
        .eq('id', listingId)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (error) {
        console.warn('Editable listing lookup failed:', error.code)
    }

    if (!listing) {
        notFound()
    }

    if (listing.status !== 'active') {
        const status = listing.status as ListingStatus
        return (
            <div className="mx-auto w-full max-w-xl rounded-3xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
                <LockKeyhole className="mx-auto size-10 text-primary" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold text-foreground">Listing details are locked</h1>
                <p className="mt-3 leading-7 text-muted-foreground">
                    &ldquo;{listing.title}&rdquo; is {LISTING_STATUS_LABELS[status] ?? listing.status}.
                    Details can only be edited while a listing is active.
                </p>
                <Link
                    href="/profile?tab=listings"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back to My Listings
                </Link>
            </div>
        )
    }

    const editableListing: EditableListingDetails = {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        category: listing.category as ListingCategory,
        other_category: listing.other_category,
        condition: listing.condition as ListingCondition,
        transaction_types: listing.transaction_types as ListingTransactionType[],
        price_cents: listing.price_cents,
        pickup_area: listing.pickup_area,
    }

    return (
        <div className="mx-auto w-full max-w-2xl">
            <Link
                href="/profile?tab=listings"
                className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
                <ArrowLeft className="size-4" aria-hidden="true" />
                My Listings
            </Link>
            <header className="mb-7 text-left">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                    Edit listing
                </p>
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
                    Update your trinket
                </h1>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
                    Keep the details current for everyone browsing the troop.
                </p>
            </header>
            <EditListingForm listing={editableListing} />
        </div>
    )
}

export default async function EditListingPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    return (
        <main className="min-h-screen bg-background px-4 py-10 pb-32 sm:px-6">
            <EditListingContent listingId={id} />
            <BetaAppChrome />
        </main>
    )
}
