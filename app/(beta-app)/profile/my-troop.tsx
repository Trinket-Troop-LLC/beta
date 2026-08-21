'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { acceptFriendRequest, removeFriendship, sendFriendRequest, searchUsers, type SearchResult } from './friendship-actions'

type FriendsData = {
    id: string
    username: string
    profilePictureUrl: string | null
}

type RequestData = FriendsData & {
    friendshipId: string
}

function PersonRow({
    person,
    children,
}: {
    person: { username: string; profilePictureUrl: string | null }
    children?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Link
                href={`/profile/${encodeURIComponent(person.username)}`}
                className="flex min-w-0 items-center gap-3 transition hover:opacity-80"
            >
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                    {person.profilePictureUrl ? (
                        <Image
                            src={person.profilePictureUrl}
                            alt={`${person.username}'s profile picture`}
                            width={48}
                            height={48}
                            className="size-full object-cover"
                        />
                    ) : (
                        <UserRound className="size-6 text-muted-foreground" />
                    )}
                </div>
                <p className="truncate font-medium text-foreground">@{person.username}</p>
            </Link>
            {children && <div className="flex shrink-0 gap-2">{children}</div>}
        </div>
    )
}

export function MyTroop({
    friendsData,
    outgoingRequests,
    incomingRequests,
}: {
    friendsData: FriendsData[]
    outgoingRequests: RequestData[]
    incomingRequests: RequestData[]
}) {
    const [tab, setTab] = useState<'friends' | 'requests'>('friends')
    const [search, setSearch] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        const trimmed = search.trim()

        if (trimmed.length === 0) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        const timeout = setTimeout(async () => {
            const result = await searchUsers(trimmed)
            if (result.success) {
                setSearchResults(result.results)
            }
            setIsSearching(false)
        }, 300)

        return () => clearTimeout(timeout)
    }, [search])

    async function handleAccept(friendshipId: string) {
        await acceptFriendRequest(friendshipId)
    }

    async function handleRemove(friendshipId: string) {
        await removeFriendship(friendshipId)
    }

    async function handleAdd(addresseeId: string) {
        await sendFriendRequest(addresseeId)
        const trimmed = search.trim()
        if (trimmed) {
            const result = await searchUsers(trimmed)
            if (result.success) setSearchResults(result.results)
        }
    }

    return (
        <div>
            <div className="mb-4 flex rounded-full border border-border bg-card p-1">
                <button
                    onClick={() => setTab('friends')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'friends' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                >
                    Friends
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'requests' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                >
                    Requests
                    {incomingRequests.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">
                            {incomingRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {tab === 'friends' && (
                <div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by username"
                        className="mb-4 w-full rounded-lg border border-input bg-card px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />

                    {search.trim() ? (
                        isSearching ? (
                            <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                                <p className="text-sm text-muted-foreground">Searching...</p>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                                <p className="text-sm text-muted-foreground">No one found.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {searchResults.map((result) => (
                                    <PersonRow key={result.id} person={result}>
                                        {result.relationship === 'friend' && (
                                            <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary">
                                                In your troop
                                            </span>
                                        )}
                                        {result.relationship === 'sent' && (
                                            <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                                Requested
                                            </span>
                                        )}
                                        {result.relationship === 'received' && (
                                            <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                                Check Requests
                                            </span>
                                        )}
                                        {result.relationship === 'none' && (
                                            <button
                                                onClick={() => handleAdd(result.id)}
                                                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                                            >
                                                Add
                                            </button>
                                        )}
                                    </PersonRow>
                                ))}
                            </div>
                        )
                    ) : friendsData.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                            <p className="text-sm text-muted-foreground">No troop members yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {friendsData.map((friend) => (
                                <PersonRow key={friend.id} person={friend} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'requests' && (
                <div className="flex flex-col gap-6">
                    <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Requests received</p>
                        {incomingRequests.length === 0 ? (
                            <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                                <p className="text-sm text-muted-foreground">Nothing yet.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {incomingRequests.map((request) => (
                                    <PersonRow key={request.friendshipId} person={request}>
                                        <button
                                            onClick={() => handleAccept(request.friendshipId)}
                                            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => handleRemove(request.friendshipId)}
                                            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
                                        >
                                            Decline
                                        </button>
                                    </PersonRow>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Requests sent</p>
                        {outgoingRequests.length === 0 ? (
                            <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                                <p className="text-sm text-muted-foreground">Nothing yet.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {outgoingRequests.map((request) => (
                                    <PersonRow key={request.friendshipId} person={request}>
                                        <button
                                            onClick={() => handleRemove(request.friendshipId)}
                                            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
                                        >
                                            Cancel
                                        </button>
                                    </PersonRow>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
