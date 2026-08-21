import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { getMyNotifications } from '@/lib/notifications/get'
import { NotificationList } from './notification-list'

async function NotificationsContent() {
    await requireMember()
    const result = await getMyNotifications()

    if (!result.success) {
        return <p className="text-sm text-red-600">{result.error}</p>
    }

    return <NotificationList notifications={result.notifications} />
}

export default function NotificationsPage() {
    return (
        <main className="relative flex min-h-screen flex-col items-center bg-[#faf7f0] px-4 pb-28 pt-12">
            <Suspense fallback={null}>
                <NotificationsContent />
            </Suspense>
        </main>
    )
}
