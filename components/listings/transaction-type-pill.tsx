import { Badge } from '@/components/ui/badge'
import {
    LISTING_TRANSACTION_TYPE_LABELS,
    LISTING_TRANSACTION_TYPE_VIEWER_LABELS,
    type ListingTransactionType,
} from '@/lib/listings/domain'

// Owners see what they're offering (sell/trade/gift/lend); everyone else
// sees it reframed as what they'd be doing (buying/trading/gifting/
// borrowing) -- same four types, different perspective.
export function TransactionTypePill({
    type,
    isOwner,
}: {
    type: ListingTransactionType
    isOwner: boolean
}) {
    return (
        <Badge variant="pill">
            {isOwner ? LISTING_TRANSACTION_TYPE_LABELS[type] : LISTING_TRANSACTION_TYPE_VIEWER_LABELS[type]}
        </Badge>
    )
}
