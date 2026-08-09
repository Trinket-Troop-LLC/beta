'use client'

import { useState } from 'react'
import { BetaHero } from '@/components/landing/beta-hero'
import { compressProfilePicture } from '@/lib/compress-profile-picture'
import { submitBetaApplication } from './actions'

const inputClass =
    'rounded-lg border border-[#d8d1c5] bg-white px-4 py-3 text-black outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20'
const labelClass = 'flex flex-col gap-2 text-[#2c2c2c]'
const checkboxLabelClass = 'flex items-center gap-2 text-[#2c2c2c]'

const categories = [
    { value: 'true', label: 'true trinkets' },
    { value: 'wearable', label: 'wearable trinkets' },
    { value: 'home', label: 'home trinkets' },
    { value: 'kitchen', label: 'kitchen trinkets' },
    { value: 'outdoorsy', label: 'outdoorsy trinkets' },
    { value: 'hobby', label: 'hobby trinkets' },
]

function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return <span className="text-sm text-red-600">{message}</span>
}

export function BetaApplicationForm() {
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCompressingPhoto, setIsCompressingPhoto] = useState(false)
    const [photoError, setPhotoError] = useState<string | null>(null)

    async function handleProfilePicChange(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const file = input.files?.[0]

        if (!file) {
            return
        }

        setPhotoError(null)
        setIsCompressingPhoto(true)

        try {
            const compressed = await compressProfilePicture(file)
            const transfer = new DataTransfer()
            transfer.items.add(compressed)
            input.files = transfer.files
        } catch {
            input.value = ''
            setPhotoError('We could not process that image. Please try a different photo.')
        } finally {
            setIsCompressingPhoto(false)
        }
    }

    async function handleSubmit(formData: FormData) {
        setError(null)
        setFieldErrors({})
        setIsSubmitting(true)

        try {
            const result = await submitBetaApplication(formData)

            if (result.success) {
                setSubmitted(true)
            } else {
                setFieldErrors(result.fieldErrors ?? {})
                if (result.error) {
                    setError(result.error)
                }
            }
        } catch {
            setError('We could not submit the beta application right now. Please try again.')
        } finally {
            setIsSubmitting(false)
    }
}

    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <BetaHero />

            <main className="mx-auto max-w-3xl px-4 py-12">
                {submitted ? (
                    <div
                        className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-8 text-center shadow-sm"
                        role="status"
                    >
                        <h2 className="text-xl font-semibold text-[#30392d]">
                            thank you for submitting your application!
                        </h2>
                        <p className="mt-2 text-[#625f58]">
                            your beta application is waiting for approval. keep an eye out for an email from us.
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
                                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                            </label>
                        </div>

                        <span id="required-indicator" className="text-sm text-[#7c8072]">
                            * required
                        </span>

                        <div className="grid gap-6 sm:grid-cols-2">
                            <label className={labelClass}>
                                <span>first name *</span>
                                <input
                                    type="text"
                                    name="first_name"
                                    autoComplete="given-name"
                                    maxLength={100}
                                    required
                                    className={inputClass}
                                />
                                <FieldError message={fieldErrors.first_name} />
                            </label>

                            <label className={labelClass}>
                                <span>last name *</span>
                                <input
                                    type="text"
                                    name="last_name"
                                    autoComplete="family-name"
                                    maxLength={100}
                                    required
                                    className={inputClass}
                                />
                                <FieldError message={fieldErrors.last_name} />
                            </label>
                        </div>

                        <label className={labelClass}>
                            <span>preferred name</span>
                            <input
                                type="text"
                                name="preferred_name"
                                autoComplete="nickname"
                                maxLength={100}
                                className={inputClass}
                            />
                            <FieldError message={fieldErrors.preferred_name} />
                        </label>

                        <label className={labelClass}>
                            <span>email *</span>
                            <input
                                type="email"
                                name="email"
                                autoComplete="email"
                                maxLength={320}
                                required
                                className={inputClass}
                            />
                            <FieldError message={fieldErrors.email} />
                        </label>

                        <label className={labelClass}>
                            <span>phone number *</span>
                            <input
                                type="tel"
                                name="phone_number"
                                autoComplete="tel"
                                maxLength={50}
                                required
                                className={inputClass}
                            />
                            <FieldError message={fieldErrors.phone_number} />
                        </label>

                        <label className={labelClass}>
                            <span>username *</span>
                            <input
                                type="text"
                                name="username"
                                autoComplete="username"
                                maxLength={100}
                                required
                                className={inputClass}
                            />
                            <FieldError message={fieldErrors.username} />
                        </label>

                        <label className={labelClass}>
                            <span>upload a profile picture *</span>
                            <input
                                type="file"
                                name="profile_pic"
                                accept="image/png,image/jpeg"
                                required
                                aria-describedby="profile-picture-help"
                                onChange={handleProfilePicChange}
                                className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-[#7c9272] file:px-3 file:py-2 file:text-white`}
                            />
                            <span id="profile-picture-help" className="text-sm text-[#7c8072]">
                                {isCompressingPhoto
                                    ? 'preparing your photo...'
                                    : 'required; PNG or JPEG — we’ll resize it automatically before uploading'}
                            </span>
                            {photoError && (
                                <span className="text-sm text-red-600">{photoError}</span>
                            )}
                            <FieldError message={fieldErrors.profile_pic} />
                        </label>

                        <label className={labelClass}>
                            <span>
                                what neighborhoods do you frequent? (live, work, or where you&apos;re regularly around) *
                            </span>
                            <textarea name="neighborhood" maxLength={2000} required rows={3} className={inputClass} />
                            <FieldError message={fieldErrors.neighborhood} />
                        </label>

                        <label className={labelClass}>
                            <span>three emojis that describe you :) *</span>
                            <input type="text" name="emojis" maxLength={100} required className={inputClass} />
                            <FieldError message={fieldErrors.emojis} />
                        </label>

                        <fieldset className="flex flex-col gap-2 text-[#2c2c2c]">
                            <legend className="mb-1 font-medium">interested in... (select all that apply) *</legend>
                            {categories.map((category) => (
                                <label key={category.value} className={checkboxLabelClass}>
                                    <input
                                        type="checkbox"
                                        name="categories"
                                        value={category.value}
                                        className="size-4 accent-[#7c9272]"
                                    />
                                    {category.label}
                                </label>
                            ))}
                            <label className={checkboxLabelClass}>
                                <input type="checkbox" name="categories" value="other" className="size-4 accent-[#7c9272]" />
                                <span>other:</span>
                                <input
                                    type="text"
                                    name="other_category"
                                    maxLength={200}
                                    aria-label="Other category"
                                    className={`${inputClass} min-w-0 flex-1`}
                                />
                            </label>
                            <FieldError message={fieldErrors.categories} />
                            <FieldError message={fieldErrors.other_category} />
                        </fieldset>

                        <label className={labelClass}>
                            <span>what are your main pain points with NYC peer-to-peer secondhand exchange?</span>
                            <textarea name="pain_points" maxLength={3000} rows={4} className={inputClass} />
                            <FieldError message={fieldErrors.pain_points} />
                        </label>

                        <label className={labelClass}>
                            <span>features you&apos;re dreaming of ...</span>
                            <textarea name="future_features" maxLength={3000} rows={3} className={inputClass} />
                            <FieldError message={fieldErrors.future_features} />
                        </label>

                        <label className={labelClass}>
                            <span>comments, questions, compliments, or concerns ;)</span>
                            <textarea name="misc_thoughts" maxLength={3000} rows={3} className={inputClass} />
                            <FieldError message={fieldErrors.misc_thoughts} />
                        </label>

                        <button
                            type="submit"
                            disabled={isSubmitting || isCompressingPhoto}
                            className="rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? 'submitting...' : isCompressingPhoto ? 'preparing photo...' : 'submit'}
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
                        <a href="https://www.instagram.com/trinkettroop/" target="_blank" rel="noreferrer" className="underline">
                            @trinkettroop
                        </a>
                        on Instagram
                    </p>
                    <a href="https://buymeacoffee.com/trinkettroop" target="_blank" rel="noreferrer" className="underline">
                        Buy us a coffee {'\u2615'}
                    </a>
                </footer>
            </main>
        </div>
    )
}
