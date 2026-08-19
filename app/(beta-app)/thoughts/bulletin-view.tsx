'use client'

import { useState } from 'react'
import { BulletinComposer } from './bulletin-composer'
import { BulletinPostCard } from './bulletin-post'
import { BulletinViewSwitcher } from './bulletin-view-switcher'

export type BulletinAuthor = {
    id: string
    username: string
    profilePictureUrl: string | null
}

export type BulletinReply = {
    id: string
    content: string
    createdAt: string
    author: BulletinAuthor
    isOwnAuthor: boolean
    photoUrls: string[]
}

export type BulletinPost = {
    id: string
    content: string
    visibility: 'global' | 'troop'
    createdAt: string
    author: BulletinAuthor
    isOwnAuthor: boolean
    isTroopAuthor: boolean
    photoUrls: string[]
    replies: BulletinReply[]
}

export function BulletinView({ posts }: { posts: BulletinPost[] }) {
    const [view, setView] = useState<'global' | 'troop'>('global')

    const visiblePosts = view === 'troop'
        ? posts.filter((post) => post.isTroopAuthor)
        : posts

    return (
        <div>
            <BulletinComposer />

            <div className="mt-8">
                <BulletinViewSwitcher view={view} onChange={setView} />
            </div>

            {visiblePosts.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm">
                    <p className="text-sm text-muted-foreground">
                        {view === 'troop'
                            ? 'No posts from your troop yet.'
                            : 'No posts yet — be the first to share something.'}
                    </p>
                </div>
            ) : (
                <div className="mt-6 flex flex-col gap-4">
                    {visiblePosts.map((post) => (
                        <BulletinPostCard key={post.id} post={post} />
                    ))}
                </div>
            )}
        </div>
    )
}
