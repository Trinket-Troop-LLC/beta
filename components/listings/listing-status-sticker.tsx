import {
    LISTING_STATUS_LABELS,
    LISTING_TRANSACTION_TYPE_COMPLETED_LABELS,
    type ListingStatus,
    type ListingTransactionType,
} from '@/lib/listings/domain'

// The rotated, hand-drawn-feeling "sold!"/"traded!"/etc. sticker shown on a
// listing card. A fulfilled listing shows what kind of exchange completed it
// (active_transaction_type, preserved through markListingFulfilled) instead
// of the generic "fulfilled" status label. Nothing renders for an active
// listing, or when overrideLabel isn't set and there's no other label to show.
export function ListingStatusSticker({
    status,
    activeTransactionType,
    overrideLabel,
}: {
    status: ListingStatus
    activeTransactionType: ListingTransactionType | null
    overrideLabel?: string
}) {
    if (!overrideLabel && status === 'active') return null

    const label = overrideLabel
        ?? (status === 'fulfilled' && activeTransactionType
            ? LISTING_TRANSACTION_TYPE_COMPLETED_LABELS[activeTransactionType]
            : LISTING_STATUS_LABELS[status])

    return (
        <span className="absolute -right-2 -top-2 -rotate-6 rounded-[50%] border border-foreground/40 bg-secondary px-3 py-1.5 text-xs font-medium italic text-foreground shadow-sm">
            {label}!
        </span>
    )
}
