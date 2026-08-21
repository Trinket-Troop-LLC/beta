'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, UserRound, Send } from 'lucide-react'
import { sendMessage, acceptConversationRequest, declineConversationRequest } from '../actions'

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
}: {
    conversationId: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    currentUserId: string
    otherUser: OtherUser
    initialMessages: Message[]
}) {
    const [messages, setMessages] = useState(initialMessages)
    const [draft, setDraft] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [currentStatus, setCurrentStatus] = useState(status)
    const bottomRef = useRef<HTMLDivElement>(null)

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
                    }
                )
                .subscribe()
        }

        setup()

        return () => {
            cancelled = true
            if (channel) db.removeChannel(channel)
        }
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

    async function handleAccept() {
        const result = await acceptConversationRequest(conversationId)
        if (result.success) {
            setCurrentStatus('active')
        }
    }

    async function handleDecline() {
        await declineConversationRequest(conversationId)
        window.location.href = '/messages'
    }

    const isPendingForMe = currentStatus === 'pending' && !initiatedByMe

    return (
        <div className="flex min-h-screen flex-col">
            <div className="flex items-center gap-3 border-b border-border/70 bg-background/90 px-4 py-3">
                <Link href="/messages" className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                    {otherUser.profilePictureUrl ? (
                        <Image
                            src={otherUser.profilePictureUrl}
                            alt={`${otherUser.username}'s profile picture`}
                            width={36}
                            height={36}
                            className="size-full object-cover"
                        />
                    ) : (
                        <UserRound className="size-4 text-input" />
                    )}
                </div>
                <p className="font-medium text-foreground">@{otherUser.username}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
                {currentStatus === 'pending' && (
                    <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
                        {isPendingForMe ? (
                            <>
                                <p className="mb-3 text-sm text-muted-foreground">
                                    @{otherUser.username} wants to start a conversation with you.
                                </p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={handleAccept}
                                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={handleDecline}
                                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
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
                                        ? 'self-end bg-primary text-primary-foreground'
                                        : 'self-start border border-border bg-card text-foreground'
                                }`}
                            >
                                {message.content}
                            </div>
                        )
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {currentStatus === 'active' && (
                <div className="flex items-center gap-2 border-t border-border/70 bg-background/90 px-4 py-3">
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSend()
                        }}
                        placeholder="Message..."
                        className="flex-1 rounded-full border border-input bg-card px-4 py-2 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isSending || !draft.trim()}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send size={16} />
                    </button>
                </div>
            )}
        </div>
    )
}