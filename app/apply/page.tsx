'use client'

import { useState } from 'react'
import { submitGeneralInterest } from './actions'
import { SiteHeader } from '@/components/layout/site-header'
import { GeneralInterestHero } from '@/components/landing/apply-hero'

export default function GeneralInterestForm() {
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(formData: FormData) {
        setError(null)
        setIsSubmitting(true)

        try {
            const result = await submitGeneralInterest(formData)

            if (result.success) {
                setSubmitted(true)
            } else {
                setError(result.error ?? 'Something went wrong')
            }
        } catch {
            setError('We could not join the waiting list right now. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const inputClass =
        'rounded-lg border border-[#d8d1c5] bg-white px-4 py-3 text-black outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20'
    const labelClass = 'flex flex-col gap-2 text-[#2c2c2c]'

    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <SiteHeader />
            <GeneralInterestHero />

            <main className="mx-auto max-w-3xl px-4 py-12">
                {submitted ? (
                    <div
                        className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-8 text-center shadow-sm"
                        role="status"
                    >
                        <h2 className="text-xl font-semibold text-[#30392d]">
                            you're on the waiting list!
                        </h2>
                        <p className="mt-2 text-[#625f58]">
                            thank you for your interest in trinket troop. we'll email you when the app is ready to download.
                        </p>
                    </div>
                ) : (
                    <form
                        action={handleSubmit}
                        className="flex flex-col gap-6 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm sm:p-8"
                    >
                        <div className="sr-only" aria-hidden="true">
                            <label>
                                Leave this field blank
                                <input
                                    type="text"
                                    name="website"
                                    tabIndex={-1}
                                    autoComplete="off"
                                />
                            </label>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                            <label className={labelClass}>
                                <span>first name</span>
                                <input
                                    type="text"
                                    name="first_name"
                                    autoComplete="given-name"
                                    maxLength={100}
                                    required
                                    className={inputClass}
                                />
                            </label>

                            <label className={labelClass}>
                                <span>last name</span>
                                <input
                                    type="text"
                                    name="last_name"
                                    autoComplete="family-name"
                                    maxLength={100}
                                    required
                                    className={inputClass}
                                />
                            </label>
                        </div>

                        <label className={labelClass}>
                            <span>email</span>
                            <input
                                type="email"
                                name="email"
                                autoComplete="email"
                                maxLength={320}
                                required
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>phone number</span>
                            <input
                                type="tel"
                                name="phone_number"
                                autoComplete="tel"
                                maxLength={50}
                                required
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>what are your main pain points with NYC peer-to-peer secondhand exchange?</span>
                            <textarea
                                name="pain_points"
                                maxLength={3000}
                                required
                                rows={4}
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>
                                if you know anyone who would love this platform, add their email(s) here so we can reach out!
                            </span>
                            <textarea
                                name="friend_emails"
                                aria-describedby="friend-emails-help"
                                maxLength={2000}
                                rows={3}
                                className={inputClass}
                            />
                            <span id="friend-emails-help" className="text-sm text-[#7c8072]">
                                separate multiple email addresses with commas or new lines. please only share friends who would be happy to hear from us.
                            </span>
                        </label>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? 'joining...' : 'join the waiting list'}
                        </button>

                        {error && (
                            <p className="text-sm text-red-600" role="alert">
                                {error}
                            </p>
                        )}
                    </form>
                )}

                <footer className="mt-10 text-center text-sm text-[#7c8072]">
                    <p className="flex flex-wrap items-center justify-center gap-1">
                        Questions? Reach us at
                        <a
                            href="https://www.instagram.com/trinkettroop/"
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                        >
                            @trinkettroop
                        </a>
                        on Instagram
                    </p>
                    <a
                        href="https://buymeacoffee.com/trinkettroop"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                    >
                        Buy us a coffee {"\u2615"}
                    </a>
                </footer>
            </main>
        </div>
    )
}
