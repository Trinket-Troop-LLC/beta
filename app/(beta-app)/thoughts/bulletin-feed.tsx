'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MessageCircle, Trash2, UserRound, Users } from 'lucide-react'
import { deletePost, deleteReply } from './actions'
import { BulletinComposer } from './bulletin-composer'
import { BulletinViewSwitcher } from './bulletin-view-switcher'
import type { BulletinAuthor, BulletinPost, BulletinReply } from './types'

function formatRelativeTime(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.round(diffMs / 60_000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.round(hours / 24)
    if (days < 7) return `${days}d ago`

    return new Date(iso).toLocaleDateString()
}

function Avatar({ author }: { author: BulletinAuthor }) {
    return (
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
            {author.profilePictureUrl ? (
                <Image
                    src={author.profilePictureUrl}
                    alt={`${author.username}'s profile picture`}
                    width={36}
                    height={36}
                    unoptimized={author.profilePictureUrl.startsWith('blob:')}
                    className="size-full object-cover"
                />
            ) : (
                <UserRound className="size-4 text-[#9aaa90]" />
            )}
        </div>
    )
}

function PhotoGrid({ photoUrls }: { photoUrls: string[] }) {
    if (photoUrls.length === 0) return null

    return (
        <div className={`grid gap-1.5 ${photoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {photoUrls.map((url, index) => (
                <div
                    key={url}
                    className="relative aspect-square overflow-hidden rounded-lg border border-[#ded8cc] bg-[#f2ede0]"
                >
                    <Image
                        src={url}
                        alt={`Photo ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 45vw, 260px"
                        className="object-cover"
                        unoptimized={url.startsWith('blob:')}
                    />
                </div>
            ))}
        </div>
    )
}

function ReplyItem({
    reply,
    canDelete,
    onDeleted,
    onReplyTo,
}: {
    reply: BulletinReply
    canDelete: boolean
    onDeleted: (replyId: string) => void
    onReplyTo: (reply: BulletinReply) => void
}) {
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        if (isDeleting) return
        setIsDeleting(true)
        const result = await deleteReply(reply.id)
        if (result.success) {
            onDeleted(reply.id)
        } else {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex gap-2.5">
            <Avatar author={reply.author} />
            <div className="min-w-0 flex-1 rounded-xl border border-[#ded8cc] bg-[#faf7f0] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#30392d]">@{reply.author.username}</p>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-[#7c8072]">{formatRelativeTime(reply.createdAt)}</span>
                        {canDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                aria-label="Delete reply"
                                className="text-[#9aaa90] transition hover:text-red-600 disabled:opacity-50"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>
                {reply.parentAuthorUsername && (
                    <p className="text-xs text-[#9aaa90]">↳ replying to @{reply.parentAuthorUsername}</p>
                )}
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#2c2c2c]">{reply.content}</p>
                {reply.photoUrls.length > 0 && (
                    <div className="mt-2 max-w-[220px]">
                        <PhotoGrid photoUrls={reply.photoUrls} />
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => onReplyTo(reply)}
                    className="mt-1 text-xs font-medium text-[#7c9272] transition hover:text-[#5f7258]"
                >
                    Reply
                </button>
            </div>
        </div>
    )
}

function PostItem({
    post,
    currentUser,
    onDeleted,
    onReplied,
}: {
    post: BulletinPost
    currentUser: BulletinAuthor
    onDeleted: (postId: string) => void
    onReplied: (postId: string, reply: BulletinReply) => void
}) {
    const [replies, setReplies] = useState(post.replies)
    const [showReplies, setShowReplies] = useState(false)
    const [replyTarget, setReplyTarget] = useState<{ parentReplyId?: string; username?: string } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        if (isDeleting) return
        setIsDeleting(true)
        const result = await deletePost(post.id)
        if (result.success) {
            onDeleted(post.id)
        } else {
            setIsDeleting(false)
        }
    }

    function handleReplyPosted(reply: BulletinReply) {
        setReplies((current) => [...current, reply])
        onReplied(post.id, reply)
        setReplyTarget(null)
        setShowReplies(true)
    }

    function handleReplyDeleted(replyId: string) {
        setReplies((current) => current
            .filter((reply) => reply.id !== replyId)
            // Mirrors the `on delete set null` on parent_reply_id: a reply
            // that was targeting the one just deleted loses its "replying
            // to" tag instead of disappearing itself.
            .map((reply) => reply.parentReplyId === replyId
                ? { ...reply, parentReplyId: null, parentAuthorUsername: null }
                : reply))
    }

    return (
        <article className="flex flex-col gap-3 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <Avatar author={post.author} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate font-medium text-[#30392d]">@{post.author.username}</p>
                            {post.visibility === 'troop' && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f2ede0] px-2 py-0.5 text-[11px] font-medium text-[#625f58]">
                                    <Users size={11} />
                                    Troop only
                                </span>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-[#7c8072]">{formatRelativeTime(post.createdAt)}</span>
                            {post.author.id === currentUser.id && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    aria-label="Delete post"
                                    className="text-[#9aaa90] transition hover:text-red-600 disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[#2c2c2c]">{post.content}</p>
                </div>
            </div>

            {post.photoUrls.length > 0 && (
                <div className="max-w-md">
                    <PhotoGrid photoUrls={post.photoUrls} />
                </div>
            )}

            <div className="flex items-center gap-4 border-t border-[#ded8cc]/70 pt-2">
                <button
                    type="button"
                    onClick={() => setShowReplies((current) => !current)}
                    className="flex items-center gap-1.5 text-sm text-[#625f58] transition hover:text-[#30392d]"
                >
                    <MessageCircle size={15} />
                    {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'reply'}
                </button>
                {!replyTarget && (
                    <button
                        type="button"
                        onClick={() => { setReplyTarget({}); setShowReplies(true) }}
                        className="text-sm font-medium text-[#7c9272] transition hover:text-[#5f7258]"
                    >
                        Write a reply
                    </button>
                )}
            </div>

            {showReplies && replies.length > 0 && (
                <div className="flex flex-col gap-2.5 pl-1">
                    {replies.map((reply) => (
                        <ReplyItem
                            key={reply.id}
                            reply={reply}
                            canDelete={reply.author.id === currentUser.id}
                            onDeleted={handleReplyDeleted}
                            onReplyTo={(target) => setReplyTarget({ parentReplyId: target.id, username: target.author.username })}
                        />
                    ))}
                </div>
            )}

            {replyTarget && (
                <BulletinComposer
                    variant="reply"
                    postId={post.id}
                    currentUser={currentUser}
                    parentReplyId={replyTarget.parentReplyId}
                    replyingToUsername={replyTarget.username}
                    onPosted={handleReplyPosted}
                    onCancel={() => setReplyTarget(null)}
                />
            )}
        </article>
    )
}

export function BulletinFeed({
    initialPosts,
    currentUser,
}: {
    initialPosts: BulletinPost[]
    currentUser: BulletinAuthor
}) {
    const [posts, setPosts] = useState(initialPosts)
    const [view, setView] = useState<'global' | 'troop'>('global')

    function handlePosted(post: BulletinPost) {
        setPosts((current) => [post, ...current])
    }

    function handleDeleted(postId: string) {
        setPosts((current) => current.filter((post) => post.id !== postId))
    }

    function handleReplied(postId: string, reply: BulletinReply) {
        setPosts((current) => current.map((post) => post.id === postId
            ? { ...post, replies: [...post.replies, reply] }
            : post))
    }

    const visiblePosts = view === 'troop' ? posts.filter((post) => post.isTroopAuthor) : posts

    return (
        <div className="flex flex-col gap-4">
            <BulletinComposer variant="post" currentUser={currentUser} onPosted={handlePosted} />

            <BulletinViewSwitcher view={view} onChange={setView} />

            {visiblePosts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#ded8cc] bg-[#fffdf9] p-6 text-center text-sm text-[#625f58]">
                    {view === 'troop'
                        ? 'No posts from your troop yet.'
                        : 'No posts yet — be the first to share something with the troop.'}
                </p>
            ) : (
                visiblePosts.map((post) => (
                    <PostItem
                        key={post.id}
                        post={post}
                        currentUser={currentUser}
                        onDeleted={handleDeleted}
                        onReplied={handleReplied}
                    />
                ))
            )}
        </div>
    )
}
