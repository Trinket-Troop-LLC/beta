// app/troop/thoughts/page.tsx
import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { signBulletinPhotoUrls } from '@/lib/supabase/bulletin-photos'
import { BetaAppChrome } from '@/components/beta-app-chrome'
import { BulletinFeed } from './bulletin-feed'
import type { BulletinAuthor, BulletinPost, BulletinReply } from './types'

const maxPosts = 50

async function ThoughtsContent() {
    const { db, user } = await requireMember()

    const { data: postRows } = await db
        .from('bulletin_posts')
        .select('id, author_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(maxPosts)

    const posts = postRows ?? []
    const postIds = posts.map((post) => post.id)

    const { data: replyRows } = postIds.length > 0
        ? await db
            .from('bulletin_replies')
            .select('id, post_id, author_id, content, created_at, parent_reply_id')
            .in('post_id', postIds)
            .order('created_at', { ascending: true })
        : { data: [] }

    const replies = replyRows ?? []
    const replyIds = replies.map((reply) => reply.id)

    const { data: postPhotoRows } = postIds.length > 0
        ? await db
            .from('bulletin_post_photos')
            .select('post_id, storage_path, position')
            .in('post_id', postIds)
            .order('position', { ascending: true })
        : { data: [] }

    const { data: replyPhotoRows } = replyIds.length > 0
        ? await db
            .from('bulletin_reply_photos')
            .select('reply_id, storage_path, position')
            .in('reply_id', replyIds)
            .order('position', { ascending: true })
        : { data: [] }

    const authorIds = [...new Set([
        ...posts.map((post) => post.author_id),
        ...replies.map((reply) => reply.author_id),
    ])]

    const { data: authorRows } = authorIds.length > 0
        ? await db
            .from('users')
            .select('id, username, responses')
            .in('id', authorIds)
        : { data: [] }

    const authorPictureUrls = await signProfilePictureUrls(
        db,
        (authorRows ?? []).map((author) => author.responses?.profile_picture_path),
    )

    const authorsById = new Map<string, BulletinAuthor>(
        (authorRows ?? []).map((author) => [author.id, {
            id: author.id,
            username: author.username,
            profilePictureUrl: (author.responses?.profile_picture_path
                && authorPictureUrls.get(author.responses.profile_picture_path)) ?? null,
        }]),
    )

    const allPhotoPaths = [
        ...(postPhotoRows ?? []).map((photo) => photo.storage_path),
        ...(replyPhotoRows ?? []).map((photo) => photo.storage_path),
    ]
    const photoUrlsByPath = await signBulletinPhotoUrls(db, allPhotoPaths)

    const unknownAuthor: BulletinAuthor = { id: '', username: 'unknown', profilePictureUrl: null }

    const postPhotosByPostId = new Map<string, string[]>()
    for (const photo of postPhotoRows ?? []) {
        const url = photoUrlsByPath.get(photo.storage_path)
        if (!url) continue
        const existing = postPhotosByPostId.get(photo.post_id) ?? []
        existing.push(url)
        postPhotosByPostId.set(photo.post_id, existing)
    }

    const replyPhotosByReplyId = new Map<string, string[]>()
    for (const photo of replyPhotoRows ?? []) {
        const url = photoUrlsByPath.get(photo.storage_path)
        if (!url) continue
        const existing = replyPhotosByReplyId.get(photo.reply_id) ?? []
        existing.push(url)
        replyPhotosByReplyId.set(photo.reply_id, existing)
    }

    const authorUsernameByReplyId = new Map(
        replies.map((reply) => [reply.id, authorsById.get(reply.author_id)?.username ?? unknownAuthor.username]),
    )

    const repliesByPostId = new Map<string, BulletinReply[]>()
    for (const reply of replies) {
        const mapped: BulletinReply = {
            id: reply.id,
            postId: reply.post_id,
            author: authorsById.get(reply.author_id) ?? unknownAuthor,
            content: reply.content,
            createdAt: reply.created_at,
            photoUrls: replyPhotosByReplyId.get(reply.id) ?? [],
            parentReplyId: reply.parent_reply_id,
            parentAuthorUsername: reply.parent_reply_id
                ? authorUsernameByReplyId.get(reply.parent_reply_id) ?? null
                : null,
        }
        const existing = repliesByPostId.get(reply.post_id) ?? []
        existing.push(mapped)
        repliesByPostId.set(reply.post_id, existing)
    }

    const feedPosts: BulletinPost[] = posts.map((post) => ({
        id: post.id,
        author: authorsById.get(post.author_id) ?? unknownAuthor,
        content: post.content,
        createdAt: post.created_at,
        photoUrls: postPhotosByPostId.get(post.id) ?? [],
        replies: repliesByPostId.get(post.id) ?? [],
    }))

    const currentUser: BulletinAuthor = authorsById.get(user.id) ?? {
        id: user.id,
        username: 'you',
        profilePictureUrl: null,
    }

    return (
        <div className="mx-auto w-full max-w-2xl text-left">
            <h1 className="mb-4 text-3xl font-semibold text-[#30392d]">Thoughts</h1>
            <BulletinFeed initialPosts={feedPosts} currentUser={currentUser} />
        </div>
    )
}

export default function ThoughtsPage() {
    return (
        <main className="relative min-h-screen bg-[#faf7f0] px-4 py-10 pb-32">
            <Suspense fallback={null}>
                <ThoughtsContent />
            </Suspense>
            <BetaAppChrome />
        </main>
    )
}
