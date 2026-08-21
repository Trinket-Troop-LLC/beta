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
                <h1 className="mb-6 text-3xl font-semibold text-foreground">Messages</h1>
                <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                    <p className="text-sm text-muted-foreground">No conversations yet.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md">
            <h1 className="mb-6 text-3xl font-semibold text-foreground">Messages</h1>

            <div className="flex flex-col gap-3">
                {conversations.map((conversation) => (
                    <Link
                        key={conversation.id}
                        href={`/messages/${conversation.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:bg-muted"
                    >
                        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                            {conversation.otherUser.profilePictureUrl ? (
                                <Image
                                    src={conversation.otherUser.profilePictureUrl}
                                    alt={`${conversation.otherUser.username}'s profile picture`}
                                    width={48}
                                    height={48}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <UserRound className="size-6 text-input" />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">@{conversation.otherUser.username}</p>
                                {conversation.status === 'pending' && !conversation.initiatedByMe && (
                                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                        New
                                    </span>
                                )}
                                {conversation.status === 'pending' && conversation.initiatedByMe && (
                                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        Pending
                                    </span>
                                )}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                                {conversation.lastMessagePreview ?? 'Say hello!'}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}