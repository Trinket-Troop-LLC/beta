'use server'

import { createClient } from '@/lib/supabase/server'

type SubscriptionInput = {
    endpoint: string
    p256dh: string
    auth: string
}

export async function savePushSubscription(subscription: SubscriptionInput) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    // Upsert on endpoint -- the same browser/device subscribing again (e.g.
    // after clearing site data) should replace its old keys, not fail on
    // the unique constraint or create a duplicate row.
    const { error } = await db
        .from('push_subscriptions')
        .upsert({
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
        }, { onConflict: 'endpoint' })

    if (error) return { success: false, error: 'Could not save your subscription.' }
    return { success: true }
}

export async function removePushSubscription(endpoint: string) {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { success: false, error: 'You must be logged in.' }

    const { error } = await db
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', user.id)

    if (error) return { success: false, error: 'Could not remove your subscription.' }
    return { success: true }
}
