import "server-only";
import { createClient } from '@/lib/supabase/server'
import { signProfilePictureUrls } from '@/lib/supabase/profile-pictures'

export type NotificationSummary = {
    id: string
    type: string
    readAt: string | null
    createdAt: string
    actor: { id: string; username: string; profilePictureUrl: string | null } | null
    relatedListingId: string | null
    relatedConversationId: string | null
    relatedBulletinPostId: string | null
}

const NOTIFICATION_PAGE_SIZE = 30

export async function getMyNotifications(): Promise
    { success: true; notifications: NotificationSummary[]; unreadCount: number } | { success: false; error: string }
> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    const { data: rows, error } = await db
        .from('notifications')
        .select('id, type, actor_id, related_listing_id, related_conversation_id, related_bulletin_post_id, read_at, created_at')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_PAGE_SIZE)

    if (error) return { success: false, error: 'Could not load notifications.' }

    const actorIds = [...new Set((rows ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))]
    const { data: actors } = actorIds.length > 0
        ? await db.from('users').select('id, username, responses').in('id', actorIds)
        : { data: [] }

    const avatarPaths = actors?.map((actor) => actor.responses?.profile_picture_path) ?? []
    const avatarUrlByPath = await signProfilePictureUrls(db, avatarPaths)

    const notifications: NotificationSummary[] = (rows ?? []).map((row) => {
        const actor = actors?.find((a) => a.id === row.actor_id)
        const avatarPath = actor?.responses?.profile_picture_path

        return {
            id: row.id,
            type: row.type,
            readAt: row.read_at,
            createdAt: row.created_at,
            actor: actor ? {
                id: actor.id,
                username: actor.username,
                profilePictureUrl: (avatarPath && avatarUrlByPath.get(avatarPath)) ?? null,
            } : null,
            relatedListingId: row.related_listing_id,
            relatedConversationId: row.related_conversation_id,
            relatedBulletinPostId: row.related_bulletin_post_id,
        }
    })

    const unreadCount = notifications.filter((n) => !n.readAt).length

    return { success: true, notifications, unreadCount }
}