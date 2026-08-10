'use client'

import { useState, useRef, useEffect } from 'react'
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
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function handleSend() {
        const trimmed = draft.trim()
        if (!trimmed || isSending) return

        setIsSending(true)
        const result = await sendMessage(conversationId, trimmed)

        if (result.success) {
            // Optimistically add it locally so it shows immediately
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    content: trimmed,
                    image_path: null,
                    created_at: new Date().toISOString(),
                    read_at: null,
                },
            ])
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
                {currentStatus === 'pending' && (
                    <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                        {isPendingForMe ? (
                            <>
                                <p className="mb-3 text-sm text-[#625f58]">
                                    @{otherUser.username} wants to start a conversation with you.
                                </p>
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={handleAccept}
                                        className="rounded-lg bg-[#7c9272] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#667b5f]"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={handleDecline}
                                        className="rounded-lg border border-[#ded8cc] px-4 py-2 text-sm font-medium text-[#625f58] transition hover:bg-[#f5efe5]"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </>
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

            {currentStatus === 'active' && (
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