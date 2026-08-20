import Link from 'next/link'
import { Bell } from 'lucide-react'

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
    return (
        <div className="fixed inset-x-0 top-0 z-40 flex justify-end px-4 pt-4">
            <Link
                href="/notifications"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                className="relative flex size-11 items-center justify-center rounded-full border border-[#ded8cc] bg-[#fffdf9]/95 text-[#30392d] shadow-lg backdrop-blur transition hover:bg-[#f5efe5]"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-[#c1443f] px-1 text-[10px] font-semibold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Link>
        </div>
    )
}
