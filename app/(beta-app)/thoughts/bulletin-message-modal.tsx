'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, X } from 'lucide-react'
import { requestBulletinMessage } from './actions'

const maxMessageLength = 1000

export function BulletinMessageModal({
    postId,
    recipientUsername,
    onClose,
}: {
    postId: string
    recipientUsername: string
    onClose: () => void
}) {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [sent, setSent] = useState(false)

    async function handleSend() {
        const trimmed = content.trim()
        if (!trimmed || isSending) return

        setIsSending(true)
        setError(null)
        const result = await requestBulletinMessage(postId, trimmed)

        if (result.success) {
            setSent(true)
        } else {
            setError(result.error)
        }
        setIsSending(false)
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                {sent ? (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                        <p className="text-sm text-foreground">
                            Message request sent to @{recipientUsername}. They&apos;ll need to accept it before you
                            can keep chatting.
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => router.push('/messages')}
                                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                            >
                                View in Messages
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="font-medium text-foreground">Message @{recipientUsername}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="text-input transition hover:text-foreground"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">
                            This sends a message request. @{recipientUsername} will see it in their Requests and can
                            accept it to start chatting.
                        </p>
                        <textarea
                            autoFocus
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            maxLength={maxMessageLength}
                            rows={4}
                            disabled={isSending}
                            placeholder={`Say something to @${recipientUsername}...`}
                            className="w-full resize-none rounded-lg border border-input bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        {error && (
                            <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>
                        )}
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSending}
                                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={isSending || !content.trim()}
                                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSending && <LoaderCircle size={14} className="animate-spin" />}
                                Send
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
