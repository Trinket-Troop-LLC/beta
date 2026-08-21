'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { formatLastActive } from '@/lib/last-active'
import type { OtherUser } from './types'

export function ConversationHeader({ otherUser }: { otherUser: OtherUser }) {
    return (
        <Link
            href={`/profile/${otherUser.id}`}
            className="flex flex-col items-center gap-2 px-4 py-4 text-center transition hover:opacity-80"
        >
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                {otherUser.profilePictureUrl ? (
                    <Image
                        src={otherUser.profilePictureUrl}
                        alt={`${otherUser.username}'s profile picture`}
                        width={80}
                        height={80}
                        className="size-full object-cover"
                    />
                ) : (
                    <UserRound className="size-8 text-[#9aaa90]" />
                )}
            </div>
            <div className="min-w-0">
                <p className="font-medium text-[#2c2c2c]">@{otherUser.username}</p>
                <p className="text-xs text-[#9aa494]">{formatLastActive(otherUser.lastActiveAt)}</p>
            </div>
        </Link>
    )
}
