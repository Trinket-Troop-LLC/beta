'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { LoaderCircle, Trash2, UserRound, Users } from 'lucide-react'
import type { BulletinAuthor, BulletinPost, BulletinReply } from './bulletin-view'
import { BulletinReplyComposer } from './bulletin-reply-composer'
import { deletePost, deleteReply } from './actions'

function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}

function Avatar({ author }: { author: BulletinAuthor }) {
    return (
        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-muted-foreground">
            {author.profilePictureUrl ? (
                <Image src={author.profilePictureUrl} alt={`${author.username}'s profile picture`} fill sizes="36px" className="object-cover" />
            ) : (
                <UserRound className="size-4" aria-hidden="true" />
            )}
        </span>
    )
}

function PhotoGrid({ photoUrls }: { photoUrls: string[] }) {
    if (photoUrls.length === 0) return null

    return (
        <div className="mt-2 grid grid-cols-3 gap-2">
            {photoUrls.map((url) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
                    <Image src={url} alt="" fill sizes="120px" className="object-cover" />
                </div>
            ))}
        </div>
    )
}

function DeleteButton({ onDelete, label }: { onDelete: () => Promise<{ success: boolean; error?: string }>; label: string }) {
    const router = useRouter()
    const [isConfirming, setIsConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    if (!isConfirming) {
        return (
            <button
                type="button"
                onClick={() => setIsConfirming(true)}
                className="text-muted-foreground transition hover:text-destructive"
                aria-label={label}
            >
                <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
        )
    }

    return (
        <span className="inline-flex items-center gap-2 text-xs">
            {error && <span className="text-destructive">{error}</span>}
            <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(async () => {
                    const result = await onDelete()
                    if (!result.success) {
                        setError(result.error ?? 'Could not delete. Try again.')
                        return
                    }
                    router.refresh()
                })}
                className="font-semibold text-destructive disabled:opacity-60"
            >
                {isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : 'Delete?'}
            </button>
            <button type="button" disabled={isPending} onClick={() => { setIsConfirming(false); setError(null) }} className="text-muted-foreground">
                Cancel
            </button>
        </span>
    )
}

function ReplyRow({ reply }: { reply: BulletinReply }) {
    return (
        <div className="flex items-start gap-2">
            <Avatar author={reply.author} />
            <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">@{reply.author.username}</p>
                    {reply.isOwnAuthor && (
                        <DeleteButton label="Delete reply" onDelete={() => deleteReply(reply.id)} />
                    )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{reply.content}</p>
                <PhotoGrid photoUrls={reply.photoUrls} />
                <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(reply.createdAt)}</p>
            </div>
        </div>
    )
}

export function BulletinPostCard({ post }: { post: BulletinPost }) {
    return (
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <Avatar author={post.author} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground">@{post.author.username}</p>
                            {post.visibility === 'troop' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                                    <Users className="size-3" aria-hidden="true" />
                                    Troop only
                                </span>
                            )}
                        </div>
                        {post.isOwnAuthor && (
                            <DeleteButton label="Delete post" onDelete={() => deletePost(post.id)} />
                        )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{post.content}</p>
                    <PhotoGrid photoUrls={post.photoUrls} />
                    <p className="mt-2 text-xs text-muted-foreground">{formatTimestamp(post.createdAt)}</p>
                </div>
            </div>

            {post.replies.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                    {post.replies.map((reply) => (
                        <ReplyRow key={reply.id} reply={reply} />
                    ))}
                </div>
            )}

            <div className="mt-3">
                <BulletinReplyComposer postId={post.id} />
            </div>
        </article>
    )
}
