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
        <div className="flex flex-col gap-2 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 shadow-sm">
            <div className="flex gap-3">
                <Avatar username={username} profilePictureUrl={profilePictureUrl} />

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                        <p className="font-medium text-[#2c2c2c]">@{username}</p>
                        <p className="line-clamp-2 text-sm text-[#7c8072]">{reason}</p>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onChat}
                                disabled={isPending}
                                className="rounded-md bg-[#7c9272] px-4 py-.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Chat
                            </button>
                            <button
                                type="button"
                                onClick={onDecline}
                                disabled={isPending}
                                className="rounded-md border border-[#ded8cc] px-4 py-.5 text-xs font-medium text-[#7c8072] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Decline
                            </button>
                        </div>
                        <span className="shrink-0 text-xs text-[#9aa494]">{formatTimestamp(timestamp)}</span>
                    </div>
                </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    )
}