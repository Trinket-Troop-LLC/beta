'use client'

import Link from 'next/link'
import Image from 'next/image'
import { UserRound } from 'lucide-react'

type ConversationSummary = {
    id: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    otherUser: {
        id: string
        username: string
        profilePictureUrl: string | null
    }
    lastMessagePreview: string | null
    updatedAt: string
}

export function ConversationsList({ conversations }: { conversations: ConversationSummary[] }) {
    if (conversations.length === 0) {
        return (
            <div className="w-full max-w-md">
                <h1 className="mb-6 text-3xl font-semibold text-[#30392d]">Messages</h1>
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <p className="text-sm text-[#625f58]">No conversations yet.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md">
            <h1 className="mb-6 text-3xl font-semibold text-[#30392d]">Messages</h1>

            <div className="flex flex-col gap-3">
                {conversations.map((conversation) => (
                    <Link
                        key={conversation.id}
                        href={`/messages/${conversation.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 shadow-sm transition hover:bg-[#f5efe5]"
                    >
                        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                            {conversation.otherUser.profilePictureUrl ? (
                                <Image
                                    src={conversation.otherUser.profilePictureUrl}
                                    alt={`${conversation.otherUser.username}'s profile picture`}
                                    width={48}
                                    height={48}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <UserRound className="size-6 text-[#9aaa90]" />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-medium text-[#2c2c2c]">@{conversation.otherUser.username}</p>
                                {conversation.status === 'pending' && !conversation.initiatedByMe && (
                                    <span className="rounded-full bg-[#7c9272] px-2 py-0.5 text-xs font-medium text-white">
                                        New
                                    </span>
                                )}
                                {conversation.status === 'pending' && conversation.initiatedByMe && (
                                    <span className="rounded-full border border-[#ded8cc] px-2 py-0.5 text-xs font-medium text-[#7c8072]">
                                        Pending
                                    </span>
                                )}
                            </div>
                            <p className="truncate text-sm text-[#7c8072]">
                                {conversation.lastMessagePreview ?? 'Say hello!'}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}