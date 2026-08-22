'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useTransition } from 'react'
import { UserRound } from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications/mark-read'
import type { NotificationSummary } from '@/lib/notifications/get'
import {
    RequestCard,
    OfferCard,
    type ConversationRequestSummary,
    type OfferSummary,
} from '@/components/messages/request-offer-cards'

function describeNotification(notification: NotificationSummary): string {
    const who = notification.actor ? `@${notification.actor.username}` : 'Someone'

    switch (notification.type) {
        case 'listing_interest':
            return `${who} is interested in one of your listings.`
        case 'friend_request':
            return `${who} sent you a friend request.`
        case 'friend_request_accepted':
            return `${who} accepted your friend request.`
        case 'bulletin_reply':
            return `${who} replied to your post.`
        case 'bulletin_message':
            return `${who} sent you a message about your post.`
        case 'exchange_cancelled':
            return `${who} cancelled an exchange.`
        case 'exchange_complete_review_prompt':
            return `${who} marked your exchange as complete. Leave a review?`
        default:
            return 'You have a new notification.'
    }
}

function notificationHref(notification: NotificationSummary): string {
    switch (notification.type) {
        case 'listing_interest':
            return notification.relatedListingId ? `/troop/listings/${notification.relatedListingId}` : '/troop'
        case 'friend_request':
        case 'friend_request_accepted':
            return notification.actor ? `/profile/${encodeURIComponent(notification.actor.username)}` : '/profile'
        case 'bulletin_reply':
            return '/thoughts'
        case 'bulletin_message':
            return notification.relatedConversationId ? `/messages/${notification.relatedConversationId}` : '/messages'
        case 'exchange_cancelled':
            return notification.relatedConversationId ? `/messages/${notification.relatedConversationId}` : '/messages'
        case 'exchange_complete_review_prompt':
            return notification.relatedConversationId ? `/review/${notification.relatedConversationId}` : '/troop'
        default:
            return '/troop'
    }
}

function timeAgo(isoDate: string): string {
    const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export function NotificationList({
    notifications: initialNotifications,
    requests: initialRequests,
    offers: initialOffers,
}: {
    notifications: NotificationSummary[]
    requests: ConversationRequestSummary[]
    offers: OfferSummary[]
}) {
    const [notifications, setNotifications] = useState(initialNotifications)
    const [requests, setRequests] = useState(initialRequests)
    const [offers, setOffers] = useState(initialOffers)
    const [, startTransition] = useTransition()

    const unreadCount = notifications.filter((n) => !n.readAt).length

    function handleRequestResolved(conversationId: string) {
        setRequests((current) => current.filter((r) => r.id !== conversationId))
    }

    function handleOfferResolved(offerId: string) {
        setOffers((current) => current.filter((o) => o.offerId !== offerId))
    }

    function handleOpen(notification: NotificationSummary) {
        if (notification.readAt) return
        setNotifications((current) =>
            current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
        )
        startTransition(async () => {
            await markNotificationRead(notification.id)
        })
    }

    function handleMarkAllRead() {
        setNotifications((current) => current.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })))
        startTransition(async () => {
            await markAllNotificationsRead()
        })
    }

    return (
        <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-3xl font-semibold text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-primary hover:underline"
                    >
                        Mark all read
                    </button>
                )}
            </div>

            {(requests.length > 0 || offers.length > 0) && (
                <div className="mb-6 flex flex-col gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Needs your response
                    </h2>
                    {requests.map((request) => (
                        <RequestCard key={request.id} conversation={request} onResolved={handleRequestResolved} />
                    ))}
                    {offers.map((offer) => (
                        <OfferCard key={offer.offerId} offer={offer} onResolved={handleOfferResolved} />
                    ))}
                </div>
            )}

            {notifications.length === 0 ? (
                requests.length === 0 && offers.length === 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                        <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
                    </div>
                )
            ) : (
                <div className="flex flex-col gap-2">
                    {notifications.map((notification) => (
                        <Link
                            key={notification.id}
                            href={notificationHref(notification)}
                            onClick={() => handleOpen(notification)}
                            className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:bg-muted ${
                                notification.readAt
                                    ? 'border-border bg-card'
                                    : 'border-primary bg-muted'
                            }`}
                        >
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                                {notification.actor?.profilePictureUrl ? (
                                    <Image
                                        src={notification.actor.profilePictureUrl}
                                        alt={`${notification.actor.username}'s profile picture`}
                                        width={40}
                                        height={40}
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <UserRound className="size-5 text-input" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-foreground">{describeNotification(notification)}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</p>
                            </div>
                            {!notification.readAt && (
                                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
