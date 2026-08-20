import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { NotificationBell } from '@/components/notification-bell'
import { getUnreadNotificationCount } from '@/lib/notifications/get'
import { getUnreadMessageCount } from '@/lib/messages/get-unread-count'

// Bottom nav + notification bell, together, so every beta-app page fetches
// both badge counts in one place instead of duplicating the queries per
// page. Counts are point-in-time as of the page render (no live/realtime
// updates) -- they refresh on the next navigation.
export async function BetaAppChrome() {
    const [unreadNotificationCount, unreadMessageCount] = await Promise.all([
        getUnreadNotificationCount(),
        getUnreadMessageCount(),
    ])

    return (
        <>
            <NotificationBell unreadCount={unreadNotificationCount} />
            <BetaBottomNav unreadMessageCount={unreadMessageCount} />
        </>
    )
}
