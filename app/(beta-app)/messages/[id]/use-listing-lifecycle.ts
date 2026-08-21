'use client'

import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { closeConversation } from '../actions'
import { markListingFulfilled, unreserveListing, markListingReturned } from '@/app/(beta-app)/troop/listing-lifecycle-actions'

export function useListingLifecycle({
    conversationId,
    listing,
    setListingStatus,
    hasHandledClosureRef,
}: {
    conversationId: string
    listing: { id: string; isOwner: boolean } | null
    setListingStatus: Dispatch<SetStateAction<string | null>>
    hasHandledClosureRef: MutableRefObject<boolean>
}) {
    const router = useRouter()
    const [isUpdatingListing, setIsUpdatingListing] = useState(false)
    const [listingActionError, setListingActionError] = useState<string | null>(null)
    const [showReturnChoice, setShowReturnChoice] = useState(false)
    const [isEnding, setIsEnding] = useState(false)
    const [showEndConfirm, setShowEndConfirm] = useState(false)
    const [endError, setEndError] = useState<string | null>(null)

    async function handleMarkFulfilled() {
        if (!listing?.isOwner || isUpdatingListing) return
        setIsUpdatingListing(true)
        setListingActionError(null)
        const result = await markListingFulfilled(listing.id)
        if (result.success) {
            hasHandledClosureRef.current = true
            setListingStatus('fulfilled')
            router.push(`/review/${result.reviewConversationId ?? conversationId}`)
        } else {
            setListingActionError(result.error ?? 'Could not update this listing.')
        }
        setIsUpdatingListing(false)
    }

    async function handleUnreserve() {
        if (!listing?.isOwner || isUpdatingListing) return
        setIsUpdatingListing(true)
        setListingActionError(null)
        const result = await unreserveListing(listing.id)
        if (result.success) {
            hasHandledClosureRef.current = true
            setListingStatus('active')
            router.push('/messages')
        } else {
            setListingActionError(result.error ?? 'Could not update this listing.')
        }
        setIsUpdatingListing(false)
    }

    async function handleMarkReturned(action: 'relist' | 'remove') {
        if (!listing?.isOwner || isUpdatingListing) return
        setIsUpdatingListing(true)
        setListingActionError(null)
        const result = await markListingReturned(listing.id, action)
        if (result.success) {
            hasHandledClosureRef.current = true
            setListingStatus(action === 'relist' ? 'active' : 'archived')
            setShowReturnChoice(false)
            router.push(`/review/${result.reviewConversationId ?? conversationId}`)
        } else {
            setListingActionError(result.error ?? 'Could not update this listing.')
        }
        setIsUpdatingListing(false)
    }

    async function handleEndConversation() {
        if (isEnding) return
        setIsEnding(true)
        setEndError(null)
        const result = await closeConversation(conversationId)
        if (result.success) {
            hasHandledClosureRef.current = true
            router.push('/messages')
        } else {
            setEndError(result.error ?? 'Could not end this conversation.')
            setIsEnding(false)
            setShowEndConfirm(false)
        }
    }

    return {
        isUpdatingListing,
        listingActionError,
        showReturnChoice,
        setShowReturnChoice,
        isEnding,
        showEndConfirm,
        setShowEndConfirm,
        endError,
        handleMarkFulfilled,
        handleUnreserve,
        handleMarkReturned,
        handleEndConversation,
    }
}
