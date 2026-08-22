import Link from 'next/link'
import Image from 'next/image'
import { formatLastActive } from '@/lib/last-active'
import { formatTimestamp } from '@/lib/format-timestamp'
import { Avatar } from '@/components/avatar'
import type { ListingTransactionType } from '@/lib/listings/domain'

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
                width={36}
                height={36}
                className="absolute right-4 top-2"
            />
        )
    }
    if (originType === 'message_board') {
        return (
            <Image
                src="/icons/bulletin-board.png"
                alt="Bulletin"
                width={36}
                height={36}
                className="absolute right-4 top-2"
            />
        )
    }
    return null
}

function emptyMessagePreview(
    originType: string,
    transactionType: ListingTransactionType | null,
    isPending: boolean,
) {
    if (originType !== 'listing' || !transactionType || !isPending) {
        return 'Say hello!'
    }

    switch (transactionType) {
        case 'sell':
            return 'Buy request sent without a message.'
        case 'gift':
            return 'Gift request sent without a message.'
        case 'lend':
            return 'Borrow request sent without a message.'
        case 'trade':
            return 'Trade request sent without a message.'
    }
}

export function ChatCard({
    href,
    username,
    profilePictureUrl,
    lastActiveAt,
    isActive,
    isPending,
    originType,
    transactionType,
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
    transactionType: ListingTransactionType | null
    title: string | null
    lastMessagePreview: string | null
    lastMessageAt: string | null
}) {
    return (
        <Link
            href={href}
            className={`relative flex gap-3 overflow-hidden rounded-2xl border border-card-border/50 p-4 shadow-sm transition ${cardBackgroundClasses(originType)}`}
        >
            <OriginIcon originType={originType} />

            <div className="flex w-20 shrink-0 flex-col items-center justify-between gap-0.5 text-center">
                <div className="flex flex-col items-center gap-1">
                    <Avatar username={username} profilePictureUrl={profilePictureUrl} />
                    <div className="flex flex-col items-center gap-0">
                        <p className="w-full text-body-sm font-normal text-message-text">@{username}</p>
                        {isActive && (
                            <p className="-mt-0.5 text-[11px] italic font-light text-message-text">{formatLastActive(lastActiveAt)}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                    {isPending && (
                        <span className="mb-1 inline-block rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Pending
                        </span>
                    )}
                    {title && <p className="truncate pr-6 font-bold text-h3 text-message-text">{title}</p>}
                    <p className="line-clamp-2 break-words text-body text-message-text">
                        {lastMessagePreview ?? emptyMessagePreview(originType, transactionType, isPending)}
                    </p>
                </div>

                <div className="flex justify-end">
                    {lastMessageAt && (
                        <span className="shrink-0 italic font-light text-body-sm text-message-text">
                            {formatTimestamp(lastMessageAt)}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}
