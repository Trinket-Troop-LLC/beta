'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MessageCircle, Send, Trash2, UserRound } from 'lucide-react'
import { deletePost, deleteReply } from './actions'
import { BulletinComposer } from './bulletin-composer'
import { BulletinMessageModal } from './bulletin-message-modal'
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
    const [showMessageModal, setShowMessageModal] = useState(false)
    const isOwnPost = post.author.id === currentUser.id

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
                        <div className="flex items-center gap-1.5">
                            <p className="font-medium text-[#30392d]">@{post.author.username}</p>
                            {post.visibility === 'troop' && (
                                <span className="rounded-full bg-[#f2ede0] px-1.5 py-0.5 text-[10px] font-medium text-[#7c9272]">
                                    Troop
                                </span>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-[#7c8072]">{formatRelativeTime(post.createdAt)}</span>
                            {isOwnPost && (
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
                {!isOwnPost && post.allowMessages && (
                    <button
                        type="button"
                        onClick={() => setShowMessageModal(true)}
                        className="ml-auto flex items-center gap-1.5 text-sm font-medium text-[#7c9272] transition hover:text-[#5f7258]"
                    >
                        <Send size={14} />
                        Message
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

            {showMessageModal && (
                <BulletinMessageModal
                    postId={post.id}
                    recipientUsername={post.author.username}
                    onClose={() => setShowMessageModal(false)}
                />
            )}
        </article>
    )
}

export function BulletinFeed({
    initialPosts,
    currentUser,
    troopAuthorIds,
}: {
    initialPosts: BulletinPost[]
    currentUser: BulletinAuthor
    troopAuthorIds: string[]
}) {
    const [posts, setPosts] = useState(initialPosts)
    const [view, setView] = useState<'all' | 'troop'>('all')
    const troopAuthorIdSet = new Set(troopAuthorIds)

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

    // Troop-only posts are RLS-visible in the general feed query (so a
    // friend's troop post can still be counted/found), but they should only
    // ever be shown inside the My Troop view, never mixed into All.
    const visiblePosts = view === 'troop'
        ? posts.filter((post) => troopAuthorIdSet.has(post.author.id))
        : posts.filter((post) => post.visibility === 'public')

    return (
        <div className="flex flex-col gap-4">
            <BulletinComposer variant="post" currentUser={currentUser} onPosted={handlePosted} />

            <div className="flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
                    type="button"
                    onClick={() => setView('all')}
                    className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        view === 'all' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    All
                </button>
                <button
                    type="button"
                    onClick={() => setView('troop')}
                    className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        view === 'troop' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    My Troop
                </button>
            </div>

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
