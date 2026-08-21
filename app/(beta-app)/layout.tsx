import { requireMember } from '@/lib/supabase/require-member'
import { getUnreadNotificationCount } from '@/lib/notifications/get'
import { getUnreadMessageCount } from '@/lib/messages/get-unread-count'
import { NotificationBell } from '@/components/notification-bell'
import { BetaBottomNav } from '@/components/beta-bottom-nav'

// Every route under (beta-app) needs the same three things: an auth/member
// check, and the two unread counts for the persistent nav chrome. Doing
// that once here -- instead of in each page, which is how this worked
// before -- means a tab switch no longer re-runs auth.getUser() up to four
// times (once per page-level requireMember() call, plus once each inside
// the notification/message/admin checks the old per-page <BetaAppChrome />
// used to do independently) just to redraw a nav bar that didn't change.
// requireMember() is cache()-wrapped, so pages that also call it directly
// for their own db/user/profile reuse this same call instead of re-querying.
export default async function BetaAppLayout({ children }: { children: React.ReactNode }) {
    const { user } = await requireMember()

    const [unreadNotificationCount, unreadMessageCount] = await Promise.all([
        getUnreadNotificationCount(user.id),
        getUnreadMessageCount(user.id),
    ])

    return (
        <>
            {children}
            <NotificationBell unreadCount={unreadNotificationCount} />
            <BetaBottomNav unreadMessageCount={unreadMessageCount} />
        </>
    )
}
