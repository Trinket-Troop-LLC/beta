'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PackagePlus, UserRound } from 'lucide-react'
import { ListingBrowseCard, type ListingBrowseCardData } from '@/components/listings/listing-browse-card'
import { formatLastActive } from '@/lib/last-active'
import {
    acceptFriendRequest,
    removeFriendship,
    sendFriendRequest,
    type Relationship,
} from '../friendship-actions'

type Responses = {
    neighborhood?: string
    emojis?: string
    categories?: string[]
    other_category?: string
} | null

const categoryLabels: Record<string, string> = {
    true: 'true trinkets',
    wearable: 'wearable trinkets',
    home: 'home trinkets',
    kitchen: 'kitchen trinkets',
    outdoorsy: 'outdoorsy trinkets',
    hobby: 'hobby trinkets',
    other: 'other trinkets',
}

function FriendAction({
    relationship,
    isPending,
    onAdd,
    onAccept,
    onDecline,
}: {
    relationship: Relationship
    isPending: boolean
    onAdd: () => void
    onAccept: () => void
    onDecline: () => void
}) {
    if (relationship === 'friend') {
        return (
            <span className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-primary">
                In your troop
            </span>
        )
    }

    if (relationship === 'sent') {
        return (
            <span className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">
                Requested
            </span>
        )
    }

    if (relationship === 'received') {
        return (
            <div className="flex shrink-0 gap-2">
                <button
                    onClick={onAccept}
                    disabled={isPending}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Accept
                </button>
                <button
                    onClick={onDecline}
                    disabled={isPending}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Decline
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={onAdd}
            disabled={isPending}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
            Add
        </button>
    )
}

export function OtherProfileSection({
    profileId,
    username,
    preferredName,
    profilePictureUrl,
    lastActive,
    responses,
    listings,
    relationship: initialRelationship,
    friendshipId: initialFriendshipId,
}: {
    profileId: string
    username: string
    preferredName: string | null
    profilePictureUrl: string | null
    lastActive: string | null
    responses: Responses
    listings: ListingBrowseCardData[]
    relationship: Relationship
    friendshipId: string | null
}) {
    const [tab, setTab] = useState<'about' | 'listings'>('about')
    const [relationship, setRelationship] = useState(initialRelationship)
    const [friendshipId, setFriendshipId] = useState(initialFriendshipId)
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleAdd() {
        setIsPending(true)
        setError(null)
        const result = await sendFriendRequest(profileId)
        if (result.success) {
            setRelationship('sent')
        } else {
            setError(result.error ?? 'Could not send that request.')
        }
        setIsPending(false)
    }

    async function handleAccept() {
        if (!friendshipId) return
        setIsPending(true)
        setError(null)
        const result = await acceptFriendRequest(friendshipId)
        if (result.success) {
            setRelationship('friend')
        } else {
            setError(result.error ?? 'Could not accept that request.')
        }
        setIsPending(false)
    }

    async function handleDecline() {
        if (!friendshipId) return
        setIsPending(true)
        setError(null)
        const result = await removeFriendship(friendshipId)
        if (result.success) {
            setRelationship('none')
            setFriendshipId(null)
        } else {
            setError(result.error ?? 'Could not complete that action.')
        }
        setIsPending(false)
    }

    return (
        <div>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 text-left">
                    <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                        {profilePictureUrl ? (
                            <Image
                                src={profilePictureUrl}
                                alt={`${username}'s profile picture`}
                                width={128}
                                height={128}
                                className="size-full object-cover"
                            />
                        ) : (
                            <UserRound className="size-12 text-muted-foreground" />
                        )}
                    </div>

                    <div className="pt-1">
                        <p className="text-xl font-semibold text-foreground">@{username}</p>
                        {preferredName && (
                            <p className="text-sm text-muted-foreground">{preferredName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatLastActive(lastActive)}</p>
                    </div>
                </div>

                <FriendAction
                    relationship={relationship}
                    isPending={isPending}
                    onAdd={handleAdd}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                />
            </div>

            {error && (
                <p role="alert" className="mb-4 text-sm text-red-600">
                    {error}
                </p>
            )}

            <div className="mb-4 flex rounded-full border border-border bg-card p-1">
                <button
                    onClick={() => setTab('about')}
                    aria-pressed={tab === 'about'}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'about'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-secondary'
                    }`}
                >
                    About
                </button>
                <button
                    onClick={() => setTab('listings')}
                    aria-pressed={tab === 'listings'}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'listings'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-secondary'
                    }`}
                >
                    Listings
                </button>
            </div>

            {tab === 'about' ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Neighborhood</p>
                        <p className="text-foreground">{responses?.neighborhood || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Emojis</p>
                        <p className="text-foreground">{responses?.emojis || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Trading categories</p>
                        <p className="text-foreground">
                            {responses?.categories?.length
                                ? responses.categories
                                      .map((category) => categoryLabels[category] ?? category)
                                      .join(', ')
                                : '—'}
                        </p>
                    </div>
                </div>
            ) : listings.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {listings.map((listing) => (
                        <Link key={listing.id} href={`/troop/listings/${listing.id}`}>
                            <ListingBrowseCard listing={listing} />
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                    <PackagePlus className="mx-auto size-8 text-primary" />
                    <p className="mt-3 font-medium text-foreground">No active listings.</p>
                </div>
            )}
        </div>
    )
}
