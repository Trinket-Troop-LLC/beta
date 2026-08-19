'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

const REDIRECT_DELAY_MS = 2000

export function TradeClosedNotice({ status }: { status: 'completed' | 'closed' }) {
    const router = useRouter()

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push('/messages')
        }, REDIRECT_DELAY_MS)

        return () => clearTimeout(timer)
    }, [router])

    const isComplete = status === 'completed'

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            {isComplete ? (
                <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
            ) : (
                <XCircle className="size-10 text-muted-foreground" aria-hidden="true" />
            )}
            <div>
                <p className="text-lg font-semibold text-foreground">
                    {isComplete ? 'This trade is complete.' : "This didn't work out."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {isComplete
                        ? 'Nice find! This conversation is now closed.'
                        : 'The listing is active again and this conversation is now closed.'}
                </p>
            </div>
            <Link
                href="/messages"
                className="mt-2 text-sm font-medium text-primary hover:underline"
            >
                Back to Messages
            </Link>
        </div>
    )
}
