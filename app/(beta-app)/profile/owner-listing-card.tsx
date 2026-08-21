'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ListingCard, type ListingCardData } from '@/components/listings/listing-card'
import { deleteListing } from './listing-actions'

export function OwnerListingCard({
    listing,
    onDeleted,
}: {
    listing: ListingCardData
    onDeleted: (listingId: string, title: string) => void
}) {
    const router = useRouter()
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const deleteButtonRef = useRef<HTMLButtonElement | null>(null)
    const keepListingButtonRef = useRef<HTMLButtonElement | null>(null)
    const restoreFocusAfterCancel = useRef(false)
    const confirmationPanelId = `delete-listing-panel-${listing.id}`
    const confirmationHeadingId = `delete-listing-heading-${listing.id}`
    const confirmationDescriptionId = `delete-listing-description-${listing.id}`
    const isDeletionPending =
        listing.status === 'archived' && listing.published_at !== null
    const triggerLabel = isDeletionPending ? 'Finish deleting' : 'Delete listing'

    useEffect(() => {
        if (isConfirming) {
            keepListingButtonRef.current?.focus()
            return
        }

        if (restoreFocusAfterCancel.current) {
            restoreFocusAfterCancel.current = false
            deleteButtonRef.current?.focus()
        }
    }, [isConfirming])

    function openConfirmation() {
        setError(null)
        setIsConfirming(true)
    }

    function cancelConfirmation() {
        if (isPending) {
            return
        }

        setError(null)
        restoreFocusAfterCancel.current = true
        setIsConfirming(false)
    }

    function handleConfirmationKeyDown(
        event: React.KeyboardEvent<HTMLDivElement>,
    ) {
        if (event.key !== 'Escape' || isPending) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        cancelConfirmation()
    }

    function confirmDeletion() {
        setError(null)

        startTransition(async () => {
            let result: Awaited<ReturnType<typeof deleteListing>>

            try {
                result = await deleteListing(listing.id)
            } catch {
                setError(
                    'The listing service did not confirm whether deletion completed. Refresh My Listings, then choose Finish deleting if the card remains.',
                )
                return
            }

            if (!result.success) {
                setError(result.error.message)
                return
            }

            onDeleted(listing.id, listing.title)
            router.refresh()
        })
    }

    const footer = (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {listing.status === 'active' && (
                    <Link
                        href={`/profile/listings/${listing.id}/edit`}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
                        aria-label={`Edit listing: ${listing.title}`}
                    >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit listing
                    </Link>
                )}
                <button
                    ref={deleteButtonRef}
                    type="button"
                    onClick={openConfirmation}
                    disabled={isConfirming}
                    aria-expanded={isConfirming}
                    aria-controls={confirmationPanelId}
                    className="inline-flex items-center gap-2 rounded-full border border-destructive/30 px-3.5 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-default disabled:opacity-50"
                    aria-label={`${triggerLabel}: ${listing.title}`}
                >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {triggerLabel}
                </button>
            </div>

            {listing.status === 'reserved' && (
                <p className="text-xs leading-5 text-muted-foreground">
                    Editing is locked while this exchange is active.
                </p>
            )}

            {isConfirming && (
                <div
                    id={confirmationPanelId}
                    className="space-y-3"
                    role="group"
                    aria-labelledby={confirmationHeadingId}
                    aria-describedby={confirmationDescriptionId}
                    aria-busy={isPending}
                    onKeyDown={handleConfirmationKeyDown}
                >
                    <div>
                        <p
                            id={confirmationHeadingId}
                            className="break-words text-sm font-semibold text-foreground"
                        >
                            Permanently delete &ldquo;{listing.title}&rdquo;?
                        </p>
                        <p
                            id={confirmationDescriptionId}
                            className="mt-1 text-xs leading-5 text-muted-foreground"
                        >
                            This will permanently delete the listing and all of its photos. This cannot be undone.
                        </p>
                    </div>

                    {error && (
                        <p
                            className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={confirmDeletion}
                            disabled={isPending}
                            aria-describedby={confirmationDescriptionId}
                            className="inline-flex items-center gap-2 rounded-full bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isPending && (
                                <LoaderCircle
                                    className="size-3.5 animate-spin"
                                    aria-hidden="true"
                                />
                            )}
                            {isPending ? 'Deleting…' : 'Delete permanently'}
                        </button>
                        <button
                            ref={keepListingButtonRef}
                            type="button"
                            onClick={cancelConfirmation}
                            disabled={isPending}
                            className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Keep listing
                        </button>
                    </div>
                </div>
            )}
        </div>
    )

    return (
        <ListingCard
            listing={listing}
            footer={footer}
            statusLabelOverride={isDeletionPending ? 'deletion pending' : undefined}
        />
    )
}
