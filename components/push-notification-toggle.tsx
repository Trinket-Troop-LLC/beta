'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { savePushSubscription, removePushSubscription } from '@/lib/notifications/push-subscribe-actions'

// Push endpoints are base64url; the browser's subscribe() call wants the
// VAPID public key as a raw Uint8Array, not the base64url string it's
// stored as.
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

type Status = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed' | 'working'

export function PushNotificationToggle() {
    const [status, setStatus] = useState<Status>('unsubscribed')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported')
            return
        }
        if (Notification.permission === 'denied') {
            setStatus('denied')
            return
        }

        navigator.serviceWorker.ready
            .then((registration) => registration.pushManager.getSubscription())
            .then((subscription) => setStatus(subscription ? 'subscribed' : 'unsubscribed'))
            .catch(() => setStatus('unsubscribed'))
    }, [])

    async function handleEnable() {
        setError(null)
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
            setError('Push notifications are not configured for this environment.')
            return
        }

        setStatus('working')
        try {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                setStatus(permission === 'denied' ? 'denied' : 'unsubscribed')
                return
            }

            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            })

            const json = subscription.toJSON()
            if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
                throw new Error('Incomplete subscription')
            }

            const result = await savePushSubscription({
                endpoint: json.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
            })

            if (!result.success) {
                setError(result.error ?? 'Could not enable push notifications.')
                setStatus('unsubscribed')
                return
            }

            setStatus('subscribed')
        } catch {
            setError('Could not enable push notifications. Please try again.')
            setStatus('unsubscribed')
        }
    }

    async function handleDisable() {
        setError(null)
        setStatus('working')
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                const endpoint = subscription.endpoint
                await subscription.unsubscribe()
                await removePushSubscription(endpoint)
            }

            setStatus('unsubscribed')
        } catch {
            setError('Could not disable push notifications. Please try again.')
            setStatus('subscribed')
        }
    }

    if (status === 'unsupported') return null

    return (
        <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {status === 'subscribed' ? (
                        <Bell className="size-4 text-[#7c9272]" />
                    ) : (
                        <BellOff className="size-4 text-[#625f58]" />
                    )}
                    <div>
                        <p className="text-sm font-medium text-[#2c2c2c]">Push notifications</p>
                        <p className="text-xs text-[#625f58]">
                            {status === 'denied'
                                ? 'Blocked in your browser settings.'
                                : status === 'subscribed'
                                ? 'Enabled on this device.'
                                : 'Get notified on this device, even when the app is closed.'}
                        </p>
                    </div>
                </div>

                {status !== 'denied' && (
                    <button
                        type="button"
                        onClick={status === 'subscribed' ? handleDisable : handleEnable}
                        disabled={status === 'working'}
                        className="shrink-0 rounded-lg border border-[#ded8cc] px-3 py-1.5 text-xs font-medium text-[#30392d] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {status === 'working' ? '…' : status === 'subscribed' ? 'Disable' : 'Enable'}
                    </button>
                )}
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
    )
}
