'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/create'

const bulletinPhotosBucket = 'bulletin-photos'
const maxBulletinPhotoCount = 4
const maxBulletinContentLength = 2000
const bulletinPhotoNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/

type ActionResult = { success: boolean; error?: string }
type CreatePostResult = { success: true; postId: string } | { success: false; error: string }
type CreateReplyResult =
    | { success: true; replyId: string; parentReplyId: string | null }
    | { success: false; error: string }

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null }
}

// Photos are uploaded directly from the browser (see bulletin-composer.tsx)
// before this action runs, since storage RLS already scopes uploads to the
// caller's own `${auth.uid()}/...` folder. This just re-checks that shape
// server-side so a post can't be made to reference a path outside the
// caller's own folder or one that isn't actually an uploaded photo name.
function getOwnedBulletinPhotoPaths(userId: string, imagePaths: string[]): string[] | null {
    if (imagePaths.length > maxBulletinPhotoCount) {
        return null
    }

    const expectedPrefix = `${userId}/`
    const validated: string[] = []

    for (const path of imagePaths) {
        if (typeof path !== 'string' || !path.startsWith(expectedPrefix)) {
            return null
        }

        const name = path.slice(expectedPrefix.length)

        if (!bulletinPhotoNamePattern.test(name)) {
            return null
        }

        validated.push(path)
    }

    if (new Set(validated).size !== validated.length) {
        return null
    }

    return validated
}

export async function createBulletinPost(
    content: string,
    imagePaths: string[],
): Promise<CreatePostResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to create a post' }

    const trimmedContent = content.trim()
    if (!trimmedContent) {
        return { success: false, error: 'Write a message to post on the bulletin' }
    }
    if (trimmedContent.length > maxBulletinContentLength) {
        return { success: false, error: `Keep posts to ${maxBulletinContentLength} characters or fewer` }
    }

    const ownedPaths = getOwnedBulletinPhotoPaths(userId, imagePaths)
    if (ownedPaths === null) {
        return { success: false, error: 'Your photos could not be attached. Please try uploading them again.' }
    }

    const { data: post, error: postError } = await db
        .from('bulletin_posts')
        .insert({
            author_id: userId,
            content: trimmedContent,
        })
        .select('id')
        .single()

    if (postError || !post) {
        return { success: false, error: 'Could not create your post. Please try again' }
    }

    if (ownedPaths.length > 0) {
        const { error: photosError } = await db
            .from('bulletin_post_photos')
            .insert(
                ownedPaths.map((path, index) => ({
                    post_id: post.id,
                    storage_path: path,
                    position: index,
                }))
            )

        if (photosError) {
            return { success: false, error: 'Post created, but photos could not be attached' }
        }
    }

    revalidatePath('/thoughts')
    return { success: true, postId: post.id }
}

// A parent reply must belong to the same post as the reply being created.
// If it doesn't (or was deleted between page load and submit), the new
// reply is still created — just without the "replying to" attribution —
// rather than failing the whole submission over a stale target.
async function resolveParentReplyId(
    db: Awaited<ReturnType<typeof createClient>>,
    postId: string,
    parentReplyId: string | null | undefined,
): Promise<string | null> {
    if (!parentReplyId) return null

    const { data: parent } = await db
        .from('bulletin_replies')
        .select('id')
        .eq('id', parentReplyId)
        .eq('post_id', postId)
        .maybeSingle()

    return parent?.id ?? null
}

export async function createBulletinReply(
    postId: string,
    content: string,
    imagePaths: string[],
    parentReplyId?: string | null,
): Promise<CreateReplyResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to create a reply' }

    const trimmedContent = content.trim()
    if (!trimmedContent) {
        return { success: false, error: 'Write a reply to post on the bulletin' }
    }
    if (trimmedContent.length > maxBulletinContentLength) {
        return { success: false, error: `Keep replies to ${maxBulletinContentLength} characters or fewer` }
    }

    const ownedPaths = getOwnedBulletinPhotoPaths(userId, imagePaths)
    if (ownedPaths === null) {
        return { success: false, error: 'Your photos could not be attached. Please try uploading them again.' }
    }

    const resolvedParentReplyId = await resolveParentReplyId(db, postId, parentReplyId)

    const { data: reply, error: replyError } = await db
        .from('bulletin_replies')
        .insert({
            post_id: postId,
            author_id: userId,
            content: trimmedContent,
            parent_reply_id: resolvedParentReplyId,
        })
        .select('id')
        .single()

    if (replyError || !reply) {
        return { success: false, error: 'Could not create your reply. Please try again' }
    }

    if (ownedPaths.length > 0) {
        const { error: photosError } = await db
            .from('bulletin_reply_photos')
            .insert(
                ownedPaths.map((path, index) => ({
                    reply_id: reply.id,
                    storage_path: path,
                    position: index,
                }))
            )

        if (photosError) {
            return { success: false, error: 'Reply posted, but photos could not be attached' }
        }
    }

    // notify whoever this reply was actually directed at: the parent
    // reply's author if this is a nested reply, otherwise the original
    // post's author — never notify someone replying to themselves
    let recipientId: string | null = null

    if (resolvedParentReplyId) {
        const { data: parentReply } = await db
            .from('bulletin_replies')
            .select('author_id')
            .eq('id', resolvedParentReplyId)
            .maybeSingle()
        recipientId = parentReply?.author_id ?? null
    } else {
        const { data: post } = await db
            .from('bulletin_posts')
            .select('author_id')
            .eq('id', postId)
            .maybeSingle()
        recipientId = post?.author_id ?? null
    }

    if (recipientId && recipientId !== userId) {
        await createNotification({
            recipientId,
            type: 'bulletin_reply',
            actorId: userId,
            relatedBulletinPostId: postId,
        })
    }

    revalidatePath('/thoughts')
    return { success: true, replyId: reply.id, parentReplyId: resolvedParentReplyId }
}

export async function deletePost(postId: string): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to delete a post' }

    const { data: photos } = await db
        .from('bulletin_post_photos')
        .select('storage_path')
        .eq('post_id', postId)

    const { data: deleted, error } = await db
        .from('bulletin_posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', userId)
        .select('id')
        .maybeSingle()

    if (error) {
        return { success: false, error: 'Could not delete your post at this time. Please try again.' }
    }

    // Nothing was actually deleted (wrong id or not the author) — the photos
    // fetched above belong to someone else's post, so leave storage alone.
    if (!deleted) {
        return { success: false, error: 'That post could not be found.' }
    }

    if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path)
        const { error: storageError } = await db.storage.from(bulletinPhotosBucket).remove(paths)
        if (storageError) {
            console.error('Could not remove bulletin post photos from storage', { postId, storageError })
        }
    }

    revalidatePath('/thoughts')
    return { success: true }
}

export async function deleteReply(replyId: string): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to delete a reply' }

    const { data: photos } = await db
        .from('bulletin_reply_photos')
        .select('storage_path')
        .eq('reply_id', replyId)

    const { data: deleted, error } = await db
        .from('bulletin_replies')
        .delete()
        .eq('id', replyId)
        .eq('author_id', userId)
        .select('id')
        .maybeSingle()

    if (error) {
        return { success: false, error: 'Could not delete your reply at this time. Please try again.' }
    }

    if (!deleted) {
        return { success: false, error: 'That reply could not be found.' }
    }

    if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path)
        const { error: storageError } = await db.storage.from(bulletinPhotosBucket).remove(paths)
        if (storageError) {
            console.error('Could not remove bulletin reply photos from storage', { replyId, storageError })
        }
    }

    revalidatePath('/thoughts')
    return { success: true }
}
