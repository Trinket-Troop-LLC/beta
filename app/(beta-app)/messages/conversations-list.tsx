'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
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

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
    return (
        <Link
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
    )
}

export function ConversationsList({ conversations }: { conversations: ConversationSummary[] }) {
    const active = conversations.filter((c) => c.status === 'active')
    const needsMyResponse = conversations.filter((c) => c.status === 'pending' && !c.initiatedByMe)
    const waitingOnThem = conversations.filter((c) => c.status === 'pending' && c.initiatedByMe)
    const pending = [...needsMyResponse, ...waitingOnThem]

    const [tab, setTab] = useState<'active' | 'requests'>(needsMyResponse.length > 0 ? 'requests' : 'active')

    return (
        <div className="w-full max-w-md">
            <h1 className="mb-6 text-3xl font-semibold text-[#30392d]">Messages</h1>

            <div className="mb-4 flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
                    onClick={() => setTab('active')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'active' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Messages
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'requests' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Requests
                    {needsMyResponse.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">
                            {needsMyResponse.length}
                        </span>
                    )}
                </button>
            </div>

            {tab === 'active' ? (
                active.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No active conversations yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {active.map((c) => <ConversationRow key={c.id} conversation={c} />)}
                    </div>
                )
            ) : (
                pending.length === 0 ? (
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">No pending requests.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {pending.map((c) => <ConversationRow key={c.id} conversation={c} />)}
                    </div>
                )
            )}
        </div>
    )
}