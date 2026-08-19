'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, UserRound, Send } from 'lucide-react'
import { sendMessage } from '../actions'
import { markListingFulfilled, unreserveListing, markListingReturned } from '@/app/(beta-app)/troop/listing-lifecycle-actions'

type Message = {
    id: string
    conversation_id: string
    sender_id: string
    content: string | null
    image_path: string | null
    created_at: string
    read_at: string | null
}

type OtherUser = {
    id: string
    username: string
    profilePictureUrl: string | null
}

type LinkedListing = { id: string; status: string; activeTransactionType: string | null }

export function ChatView({
    conversationId,
    status,
    initiatedByMe,
    currentUserId,
    otherUser,
    initialMessages,
    linkedListing,
    isOwnedByMe,
}: {
    conversationId: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    currentUserId: string
    otherUser: OtherUser
    initialMessages: Message[]
    linkedListing: LinkedListing | null
    isOwnedByMe: boolean
}) {
    const [messages, setMessages] = useState(initialMessages)
    const [draft, setDraft] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [listingStatus, setListingStatus] = useState(linkedListing?.status ?? null)
    const [isUpdatingListing, setIsUpdatingListing] = useState(false)
    const [listingActionError, setListingActionError] = useState<string | null>(null)
    const [showReturnChoice, setShowReturnChoice] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const isLend = linkedListing?.activeTransactionType === 'lend'

    useEffect(() => {
        const db = createClient()
        let channel: ReturnType<typeof db.channel> | undefined
        let cancelled = false

        async function setup() {
            // The browser client loads its session from cookies asynchronously.
            // Subscribing before that finishes joins the channel as `anon`, which
            // makes auth.uid() resolve to null inside RLS during postgres_changes
            // evaluation, so every change gets silently filtered out for every
            // subscriber. Explicitly set the token before subscribing.
            const { data: { session } } = await db.auth.getSession()
            if (cancelled) return
            if (session) db.realtime.setAuth(session.access_token)

            channel = db.channel(`conversations:${conversationId}`)

            channel.on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === newMessage.id)) return prev
                        return [...prev, newMessage]
                    })
                }
            )

            // Lets the non-owner participant see live when the owner marks the
            // listing complete or says it didn't work out -- previously only the
            // owner's own click updated local state, so the other side had no
            // way to find out short of refreshing.
            if (linkedListing) {
                channel.on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'listings',
                        filter: `id=eq.${linkedListing.id}`,
                    },
                    (payload) => {
                        const updated = payload.new as { status: string }
                        setListingStatus(updated.status)
                    }
                )
            }

            channel.subscribe()
        }

        setup()

        return () => {
            cancelled = true
            if (channel) db.removeChannel(channel)
        }
    }, [conversationId, linkedListing])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'})
    }, [messages])

    async function handleSend() {
        const trimmed = draft.trim()
        if (!trimmed || isSending) return

        setIsSending(true)
        const result = await sendMessage(conversationId, trimmed)

        if (result.success) {
            // Add it locally with its real id so the realtime echo of our own
            // insert (now that the subscription auth race is fixed) dedupes
            // against this instead of rendering a second copy.
            setMessages((prev) => {
                if (prev.some((m) => m.id === result.message.id)) return prev
                return [...prev, result.message]
            })
            setDraft('')
        }
        setIsSending(false)
    }

    async function handleMarkFulfilled() {
        if (!linkedListing || !isOwnedByMe || isUpdatingListing) return
        setIsUpdatingListing(true)
        setListingActionError(null)
        const result = await markListingFulfilled(linkedListing.id)
        if (result.success) {
            setListingStatus('fulfilled')
        } else {
            setListingActionError(result.error ?? 'Could not update this listing.')
        }
        setIsUpdatingListing(false)
    }

    async function handleUnreserve() {
        if (!linkedListing || !isOwnedByMe || isUpdatingListing) return
        setIsUpdatingListing(true)
        setListingActionError(null)
        const result = await unreserveListing(linkedListing.id)
        if (result.success) {
            setListingStatus('active')
        } else {
            setListingActionError(result.error ?? 'Could not update this listing.')
        }
        setIsUpdatingListing(false)
    }

    async function handleMarkReturned(action: 'relist' | 'remove') {
        if (!linkedListing || !isOwnedByMe || isUpdatingListing) return
        setIsUpdatingListing(true)
        setListingActionError(null)
        const result = await markListingReturned(linkedListing.id, action)
        if (result.success) {
            setListingStatus(action === 'relist' ? 'active' : 'archived')
            setShowReturnChoice(false)
        } else {
            setListingActionError(result.error ?? 'Could not update this listing.')
        }
        setIsUpdatingListing(false)
    }

    const isPendingForMe = status === 'pending' && !initiatedByMe

    return (
        <div className="flex min-h-screen flex-col">
            <div className="flex items-center gap-3 border-b border-[#ded8cc]/70 bg-[#faf7f0]/90 px-4 py-3">
                <Link href="/messages" className="text-[#625f58] hover:text-[#30392d]">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                    {otherUser.profilePictureUrl ? (
                        <Image
                            src={otherUser.profilePictureUrl}
                            alt={`${otherUser.username}'s profile picture`}
                            width={36}
                            height={36}
                            className="size-full object-cover"
                        />
                    ) : (
                        <UserRound className="size-4 text-[#9aaa90]" />
                    )}
                </div>
                <p className="font-medium text-[#2c2c2c]">@{otherUser.username}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
                {listingStatus === 'reserved' && isLend && isOwnedByMe && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        {!showReturnChoice ? (
                            <>
                                <p className="mb-3 text-sm text-[#625f58]">
                                    This item is out on loan to @{otherUser.username}.
                                </p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => setShowReturnChoice(true)}
                                        disabled={isUpdatingListing}
                                        className="rounded-lg bg-[#7c9272] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Item returned
                                    </button>
                                    <button
                                        onClick={handleUnreserve}
                                        disabled={isUpdatingListing}
                                        className="rounded-lg border border-[#ded8cc] px-4 py-2 text-sm font-medium text-[#625f58] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Didn&apos;t work out
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="mb-3 text-sm text-[#625f58]">
                                    Welcome back! What next for this item?
                                </p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => handleMarkReturned('relist')}
                                        disabled={isUpdatingListing}
                                        className="rounded-lg bg-[#7c9272] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Relist it
                                    </button>
                                    <button
                                        onClick={() => handleMarkReturned('remove')}
                                        disabled={isUpdatingListing}
                                        className="rounded-lg border border-[#ded8cc] px-4 py-2 text-sm font-medium text-[#625f58] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Remove from profile
                                    </button>
                                </div>
                            </>
                        )}
                        {listingActionError && (
                            <p className="mt-2 text-sm text-red-600">{listingActionError}</p>
                        )}
                    </div>
                )}
                {listingStatus === 'reserved' && isLend && !isOwnedByMe && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="text-sm text-[#625f58]">This item is out on loan to you.</p>
                    </div>
                )}
                {listingStatus === 'reserved' && !isLend && isOwnedByMe && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="mb-3 text-sm text-[#625f58]">
                            This listing is reserved for @{otherUser.username}.
                        </p>
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={handleMarkFulfilled}
                                disabled={isUpdatingListing}
                                className="rounded-lg bg-[#7c9272] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Mark complete
                            </button>
                            <button
                                onClick={handleUnreserve}
                                disabled={isUpdatingListing}
                                className="rounded-lg border border-[#ded8cc] px-4 py-2 text-sm font-medium text-[#625f58] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Didn&apos;t work out
                            </button>
                        </div>
                        {listingActionError && (
                            <p className="mt-2 text-sm text-red-600">{listingActionError}</p>
                        )}
                    </div>
                )}
                {listingStatus === 'reserved' && !isLend && !isOwnedByMe && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="text-sm text-[#625f58]">This listing is reserved for you.</p>
                    </div>
                )}
                {listingStatus === 'fulfilled' && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="text-sm text-[#625f58]">This listing is marked complete.</p>
                    </div>
                )}
                {listingStatus === 'archived' && linkedListing && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="text-sm text-[#625f58]">
                            {isOwnedByMe ? 'This item was taken off your profile.' : 'This item is no longer available.'}
                        </p>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        {isPendingForMe ? (
                            <p className="text-sm text-[#625f58]">
                                @{otherUser.username} wants to start a conversation with you. Accept or decline
                                from your <Link href="/messages" className="underline">Requests</Link> list.
                            </p>
                        ) : (
                            <p className="text-sm text-[#625f58]">
                                Waiting for @{otherUser.username} to accept your message.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {messages.map((message) => {
                        const isMine = message.sender_id === currentUserId
                        return (
                            <div
                                key={message.id}
                                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                                    isMine
                                        ? 'self-end bg-[#7c9272] text-white'
                                        : 'self-start border border-[#ded8cc] bg-[#fffdf9] text-[#2c2c2c]'
                                }`}
                            >
                                {message.content}
                            </div>
                        )
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {status === 'active' && (
                <div className="flex items-center gap-2 border-t border-[#ded8cc]/70 bg-[#faf7f0]/90 px-4 py-3">
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSend()
                        }}
                        placeholder="Message..."
                        className="flex-1 rounded-full border border-[#d8d1c5] bg-white px-4 py-2 text-black outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isSending || !draft.trim()}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#7c9272] text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send size={16} />
                    </button>
                </div>
            )}
        </div>
    )
}
