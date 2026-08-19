// app/troop/thoughts/page.tsx
import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { BulletinView, type BulletinAuthor, type BulletinPost, type BulletinReply } from './bulletin-view'

const POST_PAGE_SIZE = 30

type UserRow = { id: string; username: string; responses: { profile_picture_path?: string } | null }

function toAuthor(user: UserRow | undefined, pictureUrlByPath: Map<string, string>): BulletinAuthor {
    const path = user?.responses?.profile_picture_path
    return {
        id: user?.id ?? '',
        username: user?.username ?? 'troop-member',
        profilePictureUrl: (path && pictureUrlByPath.get(path)) ?? null,
    }
}

async function ThoughtsContent() {
    const { db, user } = await requireMember()

    const { data: postRows, error: postsError } = await db
        .from('bulletin_posts')
        .select('id, author_id, content, visibility, created_at')
        .order('created_at', { ascending: false })
        .limit(POST_PAGE_SIZE)

    if (postsError) {
        console.warn('Bulletin posts query failed:', postsError.code)
        return (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4 text-sm text-destructive" role="alert">
                We could not load the bulletin right now. Refresh and try again.
            </p>
        )
    }

    const posts = postRows ?? []
    const postIds = posts.map((post) => post.id)

    const [
        { data: postPhotoRows },
        { data: replyRows },
        { data: troopRows },
    ] = await Promise.all([
        postIds.length > 0
            ? db.from('bulletin_post_photos').select('post_id, storage_path, position').in('post_id', postIds).order('position', { ascending: true })
            : Promise.resolve({ data: [] as { post_id: string; storage_path: string; position: number }[] }),
        postIds.length > 0
            ? db.from('bulletin_replies').select('id, post_id, author_id, content, created_at').in('post_id', postIds).order('created_at', { ascending: true })
            : Promise.resolve({ data: [] as { id: string; post_id: string; author_id: string; content: string; created_at: string }[] }),
        db.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    ])

    const replies = replyRows ?? []
    const replyIds = replies.map((reply) => reply.id)

    const { data: replyPhotoRows } = replyIds.length > 0
        ? await db.from('bulletin_reply_photos').select('reply_id, storage_path, position').in('reply_id', replyIds).order('position', { ascending: true })
        : { data: [] as { reply_id: string; storage_path: string; position: number }[] }

    const authorIds = [...new Set([...posts.map((p) => p.author_id), ...replies.map((r) => r.author_id)])]
    const { data: authorRows } = authorIds.length > 0
        ? await db.from('users').select('id, username, responses').in('id', authorIds)
        : { data: [] as UserRow[] }

    const authorById = new Map((authorRows ?? []).map((author) => [author.id, author as UserRow]))
    const profilePicturePaths = (authorRows ?? [])
        .map((author) => author.responses?.profile_picture_path)
        .filter((path): path is string => Boolean(path))
    const pictureUrlByPath = await signProfilePictureUrls(db, profilePicturePaths)

    const allPhotoPaths = [
        ...(postPhotoRows ?? []).map((photo) => photo.storage_path),
        ...(replyPhotoRows ?? []).map((photo) => photo.storage_path),
    ]
    const { data: signedPhotos } = allPhotoPaths.length > 0
        ? await db.storage.from('bulletin-photos').createSignedUrls(allPhotoPaths, 3600)
        : { data: [] as { path: string | null; signedUrl: string }[] }
    const signedUrlByPath = new Map(
        (signedPhotos ?? [])
            .filter((photo): photo is { path: string; signedUrl: string } => Boolean(photo.path) && Boolean(photo.signedUrl))
            .map((photo) => [photo.path, photo.signedUrl] as const),
    )

    const repliesByPostId = new Map<string, BulletinReply[]>()
    for (const reply of replies) {
        const photoUrls = (replyPhotoRows ?? [])
            .filter((photo) => photo.reply_id === reply.id)
            .map((photo) => signedUrlByPath.get(photo.storage_path))
            .filter((url): url is string => Boolean(url))

        const bulletinReply: BulletinReply = {
            id: reply.id,
            content: reply.content,
            createdAt: reply.created_at,
            author: toAuthor(authorById.get(reply.author_id), pictureUrlByPath),
            isOwnAuthor: reply.author_id === user.id,
            photoUrls,
        }

        const existing = repliesByPostId.get(reply.post_id) ?? []
        existing.push(bulletinReply)
        repliesByPostId.set(reply.post_id, existing)
    }

    const troopMemberIds = new Set(
        (troopRows ?? []).map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id),
    )

    const bulletinPosts: BulletinPost[] = posts.map((post) => {
        const photoUrls = (postPhotoRows ?? [])
            .filter((photo) => photo.post_id === post.id)
            .map((photo) => signedUrlByPath.get(photo.storage_path))
            .filter((url): url is string => Boolean(url))

        return {
            id: post.id,
            content: post.content,
            visibility: post.visibility as 'global' | 'troop',
            createdAt: post.created_at,
            author: toAuthor(authorById.get(post.author_id), pictureUrlByPath),
            isOwnAuthor: post.author_id === user.id,
            isTroopAuthor: troopMemberIds.has(post.author_id) || post.author_id === user.id,
            photoUrls,
            replies: repliesByPostId.get(post.id) ?? [],
        }
    })

    return <BulletinView posts={bulletinPosts} />
}

export default function ThoughtsPage() {
    return (
        <main className="min-h-screen bg-background px-4 pt-8 pb-64 sm:px-6 sm:pt-10">
            <div className="mx-auto w-full max-w-2xl">
                <h1 className="mb-6 text-3xl font-semibold text-foreground">Thoughts</h1>
                <Suspense fallback={null}>
                    <ThoughtsContent />
                </Suspense>
            </div>
            <BetaBottomNav />
        </main>
    )
}
