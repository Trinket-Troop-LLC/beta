'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Frown, Meh, Smile } from 'lucide-react'
import { submitReview } from './actions'

const ratingOptions = [
    { label: 'Sad', value: 1, Icon: Frown },
    { label: 'Mid', value: 3, Icon: Meh },
    { label: 'Happy', value: 5, Icon: Smile },
] as const

type ReviewRating = (typeof ratingOptions)[number]['value']

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
    const [rating, setRating] = useState<ReviewRating | null>(null)
    const [experience, setExperience] = useState('')
    const [thankYouNote, setThankYouNote] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [isPending, startTransition] = useTransition()

    function handleSubmit() {
        if (rating === null) {
            setError('Choose Sad, Mid, or Happy first.')
            return
        }

        setError(null)
        startTransition(async () => {
            const result = await submitReview(
                conversationId,
                rating,
                experience,
                thankYouNote,
            )
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
            <p className="mb-4 text-sm text-muted-foreground">
                How was your exchange with @{revieweeUsername}
                {listingTitle ? ` over "${listingTitle}"` : ''}?
            </p>

            <fieldset>
                <legend className="text-sm font-medium text-foreground">Rating</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                    {ratingOptions.map(({ label, value, Icon }) => (
                        <label
                            key={value}
                            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                                rating === value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:bg-secondary'
                            }`}
                        >
                            <input
                                type="radio"
                                name="rating"
                                value={value}
                                checked={rating === value}
                                onChange={() => setRating(value)}
                                className="size-4 accent-primary"
                            />
                            <Icon className="size-7" aria-hidden="true" />
                            <span>{label}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <label className="mt-4 block" htmlFor="review-experience">
                <span className="text-sm font-medium text-foreground">
                    Tell us more about your experience
                </span>
                <span className="ml-1 text-sm text-muted-foreground">(optional)</span>
            </label>
            <p id="review-experience-help" className="mt-1 text-xs text-muted-foreground">
                Private feedback for the Trinket Troop team.
            </p>
            <textarea
                id="review-experience"
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                rows={4}
                maxLength={1000}
                aria-describedby="review-experience-help"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <label className="mt-4 block" htmlFor="review-thank-you-note">
                <span className="text-sm font-medium text-foreground">Thank you note</span>
                <span className="ml-1 text-sm text-muted-foreground">(optional)</span>
            </label>
            <p id="review-thank-you-note-help" className="mt-1 text-xs text-muted-foreground">
                This note will be shown on @{revieweeUsername}&apos;s profile.
            </p>
            <textarea
                id="review-thank-you-note"
                value={thankYouNote}
                onChange={(event) => setThankYouNote(event.target.value)}
                rows={4}
                maxLength={1000}
                aria-describedby="review-thank-you-note-help"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            {error && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isPending ? 'Submitting…' : 'Submit review'}
            </button>
        </div>
    )
}
