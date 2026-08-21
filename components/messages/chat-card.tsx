import Link from 'next/link'
import Image from 'next/image'
import { formatLastActive } from '@/lib/last-active'
import { formatTimestamp } from '@/lib/format-timestamp'
import { Avatar } from '@/components/avatar'

function cardBackgroundClasses(originType: string): string {
    if (originType === 'listing' || originType === 'offer') {
        return 'bg-listing-chat'
    }
    if (originType === 'message_board') {
        return 'bg-bulletin-chat/70'
    }
    return 'bg-card hover:bg-secondary'
}

function OriginIcon({ originType }: { originType: string }) {
    if (originType === 'listing' || originType === 'offer') {
        return (
            <Image
                src="/icons/listing.png"
                alt="Listing"
                width={30}
                height={30}
                className="absolute right-4 top-2"
            />
        )
    }
    if (originType === 'message_board') {
        return (
            <Image
                src="/icons/bulletin-board.png"
                alt="Bulletin"
                width={30}
                height={30}
                className="absolute right-4 top-2"
            />
        )
    }
    return null
}

export function ChatCard({
    href,
    username,
    profilePictureUrl,
    lastActiveAt,
    isActive,
    isPending,
    originType,
    title,
    lastMessagePreview,
    lastMessageAt,
}: {
    href: string
    username: string
    profilePictureUrl: string | null
    lastActiveAt: string | null
    isActive: boolean
    isPending: boolean
    originType: string
    title: string | null
    lastMessagePreview: string | null
    lastMessageAt: string | null
}) {
    return (
        <Link
            href={href}
            className={`relative flex gap-3 rounded-2xl border border-card-border/50 p-4 shadow-sm transition ${cardBackgroundClasses(originType)}`}
        >
            <OriginIcon originType={originType} />

            <div className="flex w-20 shrink-0 flex-col items-center justify-between gap-0.5 text-center">
                <div className="flex flex-col items-center gap-1">
                    <Avatar username={username} profilePictureUrl={profilePictureUrl} />
                    <p className="w-full truncate text-xs font-medium text-message-text">@{username}</p>
                </div>
                {isActive && (
                    <p className="text-[10px] text-message-text">{formatLastActive(lastActiveAt)}</p>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                    {isPending && (
                        <span className="mb-1 inline-block rounded-full border border-[#ded8cc] px-2 py-0.5 text-xs font-medium text-[#7c8072]">
                            Pending
                        </span>
                    )}
                    {title && <p className="truncate pr-6 font-medium text-[#2c2c2c]">{title}</p>}
                    <p className="line-clamp-2 text-sm text-message-text">{lastMessagePreview ?? 'Say hello!'}</p>
                </div>

                <div className="flex justify-end">
                    {lastMessageAt && (
                        <span className="shrink-0 text-xs text-message-text">
                            {formatTimestamp(lastMessageAt)}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}