'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { submitReview } from './actions'

export function ReviewForm({
    conversationId,
    revieweeUsername,
    listingTitle,
}: {
    conversationId: string
    revieweeUsername: string
    listingTitle: string | null
}) {
    const router = useRouter()
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [comment, setComment] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [isPending, startTransition] = useTransition()

    function handleSubmit() {
        if (rating === 0) {
            setError('Choose a rating first.')
            return
        }
        setError(null)
        startTransition(async () => {
            const result = await submitReview(conversationId, rating, comment)
            if (!result.success) {
                setError(result.error ?? 'Could not submit your review. Please try again.')
                return
            }
            setSubmitted(true)
        })
    }

    if (submitted) {
        return (
            <div className="rounded-2xl border border-border bg-card p-4 text-left">
                <p className="text-sm text-muted-foreground">Thanks for reviewing @{revieweeUsername}!</p>
                <button
                    type="button"
                    onClick={() => router.push('/troop')}
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                    Back to browsing
                </button>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-border bg-card p-4 text-left">
            <p className="mb-3 text-sm text-muted-foreground">
                How was your exchange with @{revieweeUsername}
                {listingTitle ? ` over "${listingTitle}"` : ''}?
            </p>

            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`${value} star${value === 1 ? '' : 's'}`}
                        className="p-0.5"
                    >
                        <Star
                            className={`size-7 ${
                                (hoverRating || rating) >= value
                                    ? 'fill-primary text-primary'
                                    : 'text-border'
                            }`}
                        />
                    </button>
                ))}
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment (optional)"
                rows={3}
                maxLength={1000}
                className="mt-3 w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isPending ? 'Submitting…' : 'Submit review'}
            </button>
        </div>
    )
}
