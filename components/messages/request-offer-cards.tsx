'use client'

import { useState, useTransition } from 'react'
import { acceptListingOffer, declineListingOffer } from '@/app/(beta-app)/troop/listing-lifecycle-actions'
import { acceptConversationRequest, declineConversationRequest } from '@/app/(beta-app)/messages/actions'
import { NotificationCard } from '@/components/messages/notification-card'

export type ConversationRequestSummary = {
    id: string
    otherUser: {
        username: string
        profilePictureUrl: string | null
    }
    lastMessagePreview: string | null
    updatedAt: string
}

export type OfferSummary = {
    offerId: string
    createdAt: string
    targetListing: { id: string; title: string }
    offerer: { id: string; username: string; profilePictureUrl: string | null }
    offeredListing: { id: string; title: string; coverPhotoUrl: string | null }
}

export function RequestCard({
    conversation,
    onResolved,
}: {
    conversation: ConversationRequestSummary
    onResolved: (conversationId: string) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleChat() {
        setError(null)
        startTransition(async () => {
            const result = await acceptConversationRequest(conversation.id)
            if (!result.success) {
                setError(result.error ?? 'Could not accept this request.')
                return
            }
            onResolved(conversation.id)
            window.location.href = `/messages/${conversation.id}`
        })
    }

    function handleDecline() {
        setError(null)
        startTransition(async () => {
            const result = await declineConversationRequest(conversation.id)
            if (!result.success) {
                setError(result.error ?? 'Could not decline this request.')
                return
            }
            onResolved(conversation.id)
        })
    }

    return (
        <NotificationCard
            username={conversation.otherUser.username}
            profilePictureUrl={conversation.otherUser.profilePictureUrl}
            reason={conversation.lastMessagePreview ?? 'Say hello!'}
            timestamp={conversation.updatedAt}
            isPending={isPending}
            error={error}
            onChat={handleChat}
            onDecline={handleDecline}
        />
    )
}

export function OfferCard({
    offer,
    onResolved,
}: {
    offer: OfferSummary
    onResolved: (offerId: string) => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function handleChat() {
        setError(null)
        startTransition(async () => {
            const result = await acceptListingOffer(offer.offerId)
            if (!result.success) {
                setError(result.error ?? 'Could not accept this offer.')
                return
            }
            onResolved(offer.offerId)
            if (result.conversationId) {
                window.location.href = `/messages/${result.conversationId}`
            }
        })
    }

    function handleDecline() {
        setError(null)
        startTransition(async () => {
            const result = await declineListingOffer(offer.offerId)
            if (!result.success) {
                setError(result.error ?? 'Could not decline this offer.')
                return
            }
            onResolved(offer.offerId)
        })
    }

    return (
        <NotificationCard
            username={offer.offerer.username}
            profilePictureUrl={offer.offerer.profilePictureUrl}
            reason={
                <>
                    Offered <span className="font-medium text-foreground">{offer.offeredListing.title}</span> for your{' '}
                    <span className="font-medium text-foreground">{offer.targetListing.title}</span>
                </>
            }
            timestamp={offer.createdAt}
            isPending={isPending}
            error={error}
            onChat={handleChat}
            onDecline={handleDecline}
        />
    )
}
