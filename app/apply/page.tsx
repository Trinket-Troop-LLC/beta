'use client'

import { useState } from 'react'
import { submitApplication } from './actions'
import { SiteHeader } from '@/components/layout/site-header'
import { ApplyHero } from '@/components/landing/apply-hero'

export default function ApplicationForm() {
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        setError(null)

        const result = await submitApplication(formData)

        if (result.success) {
            setSubmitted(true)
        } else {
            setError(result.error ?? 'Something went wrong')
        }
    }

    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <SiteHeader />
            <ApplyHero />
            <main className="mx-auto max-w-3xl px-4 py-12">
                {submitted ? (
                <p className="text-center text-lg text-[#455442]">
                    Thank you for submitting your application! Keep an eye out for an
                    email from us.
                </p>
                ) : (
                <form
                    action={handleSubmit}
                    className="flex flex-col gap-6 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-8 shadow-sm"
                >
                    <label className="flex flex-col gap-2">
                        <span>Name</span>
                        <input
                            type="text"
                            name="name"
                            required
                            className="rounded-lg border border-[#d8d1c5] px-4 py-3"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span>Email</span>
                        <input
                            type="email"
                            name="email"
                            required
                            className="rounded-lg border border-[#d8d1c5] px-4 py-3"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span>Why are you interested?</span>
                        <textarea
                            name="why_interested"
                            required
                            rows={4}
                            className="rounded-lg border border-[#d8d1c5] px-4 py-3"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span>How did you hear about us?</span>
                        <textarea
                            name="how_heard"
                            required
                            rows={3}
                            className="rounded-lg border border-[#d8d1c5] px-4 py-3"
                        />
                    </label>

                    <button
                        type="submit"
                        className="rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f]"
                    >
                        Submit
                    </button>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </form>
            )}
        </main>
    </div>
    )
}

