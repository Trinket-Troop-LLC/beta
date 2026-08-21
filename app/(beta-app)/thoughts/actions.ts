'use server'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { success: boolean; error?: string }

async function getCurrentUserId() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    return { db, userId: user?.id ?? null}
}

export async function createBulletinPost(
    content: string,
    imagePaths: string[],
) {
    // check if user exists
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to create a post'}

    const trimmedContent = content.trim()
    if (!trimmedContent) {
        return { success: false, error: 'Write a message to post on the bulletin'}
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
        return { success: false, error: 'Could not create your post. Please try again'}
    }

    // inserting the images
    if (imagePaths.length > 0) {
        const { error: photosError } = await db
            .from('bulletin_post_photos')
            .insert(
                imagePaths.map((path, index) => ({
                    post_id: post.id,
                    storage_path: path,
                    position: index,
                }))
            )

        if (photosError) {
            return { success: false, error: 'Post created, but photos could not be attached'}
        }
    }

    return { success: true, postId: post.id}
}

export async function createBulletinReply(
    postId: string,
    content: string,
    imagePaths: string[],
) {
    // check if user exists
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to create a reply'}

    const trimmedContent = content.trim()
    if (!trimmedContent) {
        return { success: false, error: 'Write a reply to post on the bulletin'}
    }

    const { data: reply, error: replyError } = await db
        .from('bulletin_replies')
        .insert({
            post_id: postId,
            author_id: userId,
            content: trimmedContent,
        })
        .select('id')
        .single()
    
    if (replyError || !reply) {
        return { success: false, error: 'Could not create your reply. Please try again'}
    }

    // inserting the images
    if (imagePaths.length > 0) {
        const { error: photosError } = await db
            .from('bulletin_reply_photos')
            .insert(
                imagePaths.map((path, index) => ({
                    reply_id: reply.id,
                    storage_path: path,
                    position: index,
                }))
            )

        if (photosError) {
            return { success: false, error: 'Post created, but photos could not be attached'}
        }
    }

    return { success: true, replyId: reply.id}
}

export async function deletePost(
    postId: string
): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to delete a post' }

    const { data: photos } = await db
        .from('bulletin_post_photos')
        .select('storage_path')
        .eq('post_id', postId)

    const { error } = await db
        .from('bulletin_posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', userId)

    if (error) {
        return { success: false, error: 'Could not delete your post at this time. Please try again.' }
    }

    if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path)
        const { error: storageError } = await db.storage.from('bulletin-photos').remove(paths)
        if (storageError) {
            console.error('Could not remove bulletin post photos from storage', { postId, storageError })
        }
    }
    return { success: true }
}

export async function deleteReply(
    replyId: string
): Promise<ActionResult> {
    const { db, userId } = await getCurrentUserId()
    if (!userId) return { success: false, error: 'You must be logged in to delete a reply' }

    const { data: photos } = await db
        .from('bulletin_reply_photos')
        .select('storage_path')
        .eq('reply_id', replyId)

    const { error } = await db
        .from('bulletin_replies')
        .delete()
        .eq('id', replyId)
        .eq('author_id', userId)

    if (error) {
        return { success: false, error: 'Could not delete your reply at this time. Please try again.' }
    }

    if (photos && photos.length > 0) {
        const paths = photos.map((p) => p.storage_path)
        const { error: storageError } = await db.storage.from('bulletin-photos').remove(paths)
        if (storageError) {
            console.error('Could not remove bulletin reply photos from storage', { replyId, storageError })
        }
    }
    return { success: true }
}