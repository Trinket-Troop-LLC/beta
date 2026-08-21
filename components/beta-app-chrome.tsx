import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { NotificationBell } from '@/components/notification-bell'
import { getUnreadNotificationCount } from '@/lib/notifications/get'
import { getUnreadMessageCount } from '@/lib/messages/get-unread-count'
import { createClient } from '@/lib/supabase/server'

// Bottom nav + notification bell, together, so every beta-app page fetches
// both badge counts in one place instead of duplicating the queries per
// page. Counts are point-in-time as of the page render (no live/realtime
// updates) -- they refresh on the next navigation.
export async function BetaAppChrome() {
    const [unreadNotificationCount, unreadMessageCount, isAdmin] = await Promise.all([
        getUnreadNotificationCount(),
        getUnreadMessageCount(),
        getCurrentUserIsAdmin(),
    ])

    return (
        <>
            <NotificationBell unreadCount={unreadNotificationCount} />
            <BetaBottomNav
                unreadMessageCount={unreadMessageCount}
                isAdmin={isAdmin}
            />
        </>
    )
}

async function getCurrentUserIsAdmin() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) return false

    const { data: profile } = await db
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    return profile?.role === 'admin'
}
