'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, UserRound, Send } from 'lucide-react'
import { sendMessage, markMessagesRead } from '../actions'
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

export function ChatView({
    conversationId,
    status,
    initiatedByMe,
    currentUserId,
    otherUser,
    initialMessages,
    listing,
    closedReason,
}: {
    conversationId: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    currentUserId: string
    otherUser: OtherUser
    initialMessages: Message[]
    listing: { id: string; status: string; activeTransactionType: string | null; isOwner: boolean } | null
    closedReason: 'fulfilled' | 'cancelled' | null
}) {
    const router = useRouter()
    const [messages, setMessages] = useState(initialMessages)
    const [draft, setDraft] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [listingStatus, setListingStatus] = useState(listing?.status ?? null)
    // Once fulfilled/archived, "Members view available listings or their own"
    // RLS stops a non-owner from reading the listing row at all, so their
    // postgres_changes subscription on `listings` would never deliver that
    // final transition (Realtime evaluates the SELECT policy against the new
    // row). `conversations` has no such status gating for participants, so
    // closed_reason on that row -- not listing.status -- is the reliable
    // signal for "the deal is done" on the non-owner side.
    const [dealFulfilled, setDealFulfilled] = useState(closedReason === 'fulfilled')
    const [isUpdatingListing, setIsUpdatingListing] = useState(false)
    const [listingActionError, setListingActionError] = useState<string | null>(null)
    const [showReturnChoice, setShowReturnChoice] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const isLend = listing?.activeTransactionType === 'lend'
    // handleMarkFulfilled/handleMarkReturned/handleUnreserve already redirect
    // the clicking user straight off the server action's return value -- this
    // ref stops the realtime listener below from redirecting them a second
    // time (possibly away from wherever they've since navigated to) when the
    // echo of their own update comes back over the subscription.
    const hasHandledClosureRef = useRef(false)

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

            channel = db
                .channel(`conversations:${conversationId}`)
                .on(
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
                        if (newMessage.sender_id !== currentUserId) {
                            markMessagesRead(conversationId)
                        }
                    }
                )

            // Only the owner reliably keeps read access to the listing across
            // every status it can reach (see the dealFulfilled comment above),
            // so this drives the owner's reserved/fulfilled/archived banners
            // and controls. The non-owner side's "deal is done" signal comes
            // from the conversations listener below instead.
            if (listing?.isOwner) {
                channel = channel.on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'listings',
                        filter: `id=eq.${listing.id}`,
                    },
                    (payload) => {
                        setListingStatus((payload.new as { status: string }).status)
                    }
                )
            }

            channel = channel.on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `id=eq.${conversationId}`,
                },
                (payload) => {
                    if (hasHandledClosureRef.current) return
                    const newClosedReason = (payload.new as { closed_reason: string | null }).closed_reason
                    if (newClosedReason === 'fulfilled') {
                        hasHandledClosureRef.current = true
                        setDealFulfilled(true)
                        router.push(`/review/${conversationId}`)
                    } else if (newClosedReason === 'cancelled') {
                        hasHandledClosureRef.current = true
                        router.push('/messages')
                    }
                }
            )

            // declineConversationRequest deletes the row outright rather than
            // updating its status (see 20260815010000_allow_decline_conversation_delete.sql),
            // so the initiator -- who can sit on this page watching a pending
            // request, since there's no "active" gate on viewing it -- needs
            // its own DELETE listener to get pushed out when it's declined.
            channel = channel.on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `id=eq.${conversationId}`,
                },
                () => {
                    if (hasHandledClosureRef.current) return
                    hasHandledClosureRef.current = true
                    router.push('/messages')
                }
            )

            channel.subscribe()
        }

        setup()

        return () => {
            cancelled = true
            if (channel) db.removeChannel(channel)
        }
    }, [conversationId, currentUserId, listing, router])

    // Mark as read on open, covering messages that arrived before this view
    // mounted (the realtime handler above only catches ones that arrive
    // while it's open).
    useEffect(() => {
        markMessagesRead(conversationId)
    }, [conversationId])

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
                {listingStatus === 'reserved' && isLend && listing?.isOwner && (
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
                {listingStatus === 'reserved' && !isLend && listing?.isOwner && (
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
                {(listingStatus === 'fulfilled' || (dealFulfilled && listingStatus !== 'archived')) && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="text-sm text-[#625f58]">This listing is marked complete.</p>
                    </div>
                )}
                {listingStatus === 'archived' && listing?.isOwner && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        <p className="text-sm text-[#625f58]">This item was taken off your profile.</p>
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