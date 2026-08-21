'use client'

import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markMessagesRead } from '../actions'
import type { Message } from './types'

export function useConversationRealtime({
    conversationId,
    currentUserId,
    listing,
    initialDealFulfilled,
    setMessages,
    setListingStatus,
    hasHandledClosureRef,
}: {
    conversationId: string
    currentUserId: string
    listing: { id: string; isOwner: boolean } | null
    initialDealFulfilled: boolean
    setMessages: Dispatch<SetStateAction<Message[]>>
    setListingStatus: Dispatch<SetStateAction<string | null>>
    hasHandledClosureRef: MutableRefObject<boolean>
}) {
    const router = useRouter()
    // Once fulfilled/archived, "Members view available listings or their own"
    // RLS stops a non-owner from reading the listing row at all, so their
    // postgres_changes subscription on `listings` would never deliver that
    // final transition (Realtime evaluates the SELECT policy against the new
    // row). `conversations` has no such status gating for participants, so
    // closed_reason on that row -- not listing.status -- is the reliable
    // signal for "the deal is done" on the non-owner side.
    const [dealFulfilled, setDealFulfilled] = useState(initialDealFulfilled)

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
                    } else if (newClosedReason === 'cancelled' || newClosedReason === 'closed') {
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
    }, [conversationId, currentUserId, listing, router, setMessages, setListingStatus, hasHandledClosureRef])

    // Mark as read on open, covering messages that arrived before this view
    // mounted (the postgres_changes handler above only catches ones that
    // arrive while it's open).
    useEffect(() => {
        markMessagesRead(conversationId)
    }, [conversationId])

    return { dealFulfilled }
}
