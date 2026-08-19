'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markNotificationRead(notificationId: string) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    const { error } = await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_id', user.id)
        .is('read_at', null)

    if (error) return { success: false, error: 'Could not mark as read.' }

    revalidatePath('/notifications')
    return { success: true }
}

export async function markAllNotificationsRead() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    const { error } = await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .is('read_at', null)

    if (error) return { success: false, error: 'Could not mark all as read.' }

    revalidatePath('/notifications')
    return { success: true }
}