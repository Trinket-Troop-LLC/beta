'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Message } from './types'

export function MessageList({
    messages,
    currentUserId,
    status,
    isPendingForMe,
    otherUsername,
    listingStatus,
    isListingOwner,
    dealFulfilled,
}: {
    messages: Message[]
    currentUserId: string
    status: 'pending' | 'active'
    isPendingForMe: boolean
    otherUsername: string
    listingStatus: string | null
    isListingOwner: boolean
    dealFulfilled: boolean
}) {
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4">
            {(listingStatus === 'fulfilled' || (dealFulfilled && listingStatus !== 'archived')) && (
                <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                    <p className="text-sm text-[#625f58]">This listing is marked complete.</p>
                </div>
            )}
            {listingStatus === 'archived' && isListingOwner && (
                <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                    <p className="text-sm text-[#625f58]">This item was taken off your profile.</p>
                </div>
            )}

            {status === 'pending' && (
                <div className="mb-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 text-center shadow-sm">
                    {isPendingForMe ? (
                        <p className="text-sm text-[#625f58]">
                            @{otherUsername} wants to start a conversation with you. Accept or decline
                            from your <Link href="/messages" className="underline">Requests</Link> list.
                        </p>
                    ) : (
                        <p className="text-sm text-[#625f58]">
                            Waiting for @{otherUsername} to accept your message.
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
                            className={`max-w-[75%] break-words whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
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
    )
}
