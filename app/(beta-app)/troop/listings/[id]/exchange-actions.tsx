'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { startActiveConversation } from '@/app/(beta-app)/messages/actions'
import { formatListingPrice, type ListingTransactionType } from '@/lib/listings/domain'

const EXCHANGE_ACTION_LABELS: Record<ListingTransactionType, string> = {
    sell: 'Buy',
    trade: 'Offer a trade',
    gift: 'Request it',
}

export function ExchangeActions({
    listingId,
    ownerId,
    transactionTypes,
    priceCents,
}: {
    listingId: string
    ownerId: string
    transactionTypes: ListingTransactionType[]
    priceCents: number | null
}) {
    const router = useRouter()
    const [pendingType, setPendingType] = useState<ListingTransactionType | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleAction(type: ListingTransactionType) {
        setError(null)
        setPendingType(type)
        startTransition(async () => {
            const result = await startActiveConversation(ownerId, 'offer', listingId)

            if (!result.success) {
                setError(result.error ?? 'Could not start this exchange. Please try again.')
                return
            }

            router.push(`/messages/${result.conversationId}`)
        })
    }

    return (
        <div className="mt-6 flex flex-col gap-2">
            {transactionTypes.map((type) => (
                <button
                    key={type}
                    type="button"
                    onClick={() => handleAction(type)}
                    disabled={isPending}
                    className="rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isPending && pendingType === type
                        ? 'Starting…'
                        : type === 'sell' && priceCents !== null
                            ? `${EXCHANGE_ACTION_LABELS.sell} for ${formatListingPrice(priceCents)}`
                            : EXCHANGE_ACTION_LABELS[type]}
                </button>
            ))}

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}
