'use client'

import type { ReactNode } from 'react'
import { Avatar } from '@/components/avatar'
import { formatTimestamp } from '@/lib/format-timestamp'

export function NotificationCard({
    username,
    profilePictureUrl,
    reason,
    timestamp,
    isPending,
    error,
    onChat,
    onDecline,
}: {
    username: string
    profilePictureUrl: string | null
    reason: ReactNode
    timestamp: string
    isPending: boolean
    error: string | null
    onChat: () => void
    onDecline: () => void
}) {
    return (
            <div className="flex flex-col gap-2 rounded-[20px] border border-card-border/50 bg-request-card p-4 shadow-sm">
            <div className="flex gap-3">
                <Avatar username={username} profilePictureUrl={profilePictureUrl} />

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                        <p className="font-normal text-body-sm text-message-text">@{username}</p>
                        <p className="line-clamp-2 font-normal text-body text-message-text">{reason}</p>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onChat}
                                disabled={isPending}
                                className="rounded-md border border-black/50 bg-chat-action px-4 py-0.5 text-body font-normal text-chat-action-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                chat
                            </button>
                            <button
                                type="button"
                                onClick={onDecline}
                                disabled={isPending}
                                className="rounded-md border border-black/50 bg-decline-action px-4 py-0.5 text-body font-normal text-decline-action-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                decline
                            </button>
                        </div>
                        <span className="shrink-0 font-light text-body-sm italic text-message-text">{formatTimestamp(timestamp)}</span>
                    </div>
                </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    )
}