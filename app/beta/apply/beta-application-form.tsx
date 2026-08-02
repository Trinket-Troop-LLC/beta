'use client'

import { useState } from 'react'
import { BetaHero } from '@/components/landing/beta-hero'
import { SiteHeader } from '@/components/layout/site-header'
import { submitBetaApplication } from './actions'

const inputClass =
    'rounded-lg border border-[#d8d1c5] bg-white px-4 py-3 text-black outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20'
const labelClass = 'flex flex-col gap-2 text-[#2c2c2c]'
const checkboxLabelClass = 'flex items-center gap-2 text-[#2c2c2c]'

const maxProfilePictureDimension = 1600
const profilePictureQuality = 0.85

async function compressProfilePicture(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

    try {
        const scale = Math.min(1, maxProfilePictureDimension / Math.max(bitmap.width, bitmap.height))
        const width = Math.round(bitmap.width * scale)
        const height = Math.round(bitmap.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (!context) {
            throw new Error('Canvas is not supported')
        }

        context.drawImage(bitmap, 0, 0, width, height)

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => (result ? resolve(result) : reject(new Error('Could not compress image'))),
                'image/jpeg',
                profilePictureQuality,
            )
        })

        const baseName = file.name.replace(/\.[^./]+$/, '') || 'profile-picture'
        return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
    } finally {
        bitmap.close()
    }
}

const categories = [
    { value: 'true', label: 'true trinkets' },
    { value: 'wearable', label: 'wearable trinkets' },
    { value: 'home', label: 'home trinkets' },
    { value: 'kitchen', label: 'kitchen trinkets' },
    { value: 'outdoorsy', label: 'outdoorsy trinkets' },
    { value: 'hobby', label: 'hobby trinkets' },
]

export function BetaApplicationForm() {
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
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
        setIsSubmitting(true)

        try {
            const result = await submitBetaApplication(formData)

            if (result.success) {
                setSubmitted(true)
            } else {
                setError(result.error ?? 'Something went wrong')
            }
        } catch {
            setError('We could not submit the beta application right now. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <SiteHeader />
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
                            <span>preferred name</span>
                            <input
                                type="text"
                                name="preferred_name"
                                autoComplete="nickname"
                                maxLength={100}
                                className={inputClass}
                            />
                        </label>

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
                            <span>username</span>
                            <input
                                type="text"
                                name="username"
                                autoComplete="username"
                                maxLength={100}
                                required
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>upload a profile picture</span>
                            <input
                                type="file"
                                name="profile_pic"
                                accept="image/png,image/jpeg"
                                aria-describedby="profile-picture-help"
                                onChange={handleProfilePicChange}
                                required
                                className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-[#7c9272] file:px-3 file:py-2 file:text-white`}
                            />
                            <span id="profile-picture-help" className="text-sm text-[#7c8072]">
                                {isCompressingPhoto
                                    ? 'preparing your photo...'
                                    : 'PNG or JPEG — we’ll resize it automatically before uploading'}
                            </span>
                            {photoError && (
                                <p className="text-sm text-red-600" role="alert">
                                    {photoError}
                                </p>
                            )}
                        </label>

                        <label className={labelClass}>
                            <span>
                                what neighborhoods do you frequent? (live, work, or where you&apos;re regularly around)
                            </span>
                            <textarea
                                name="neighborhood"
                                maxLength={2000}
                                required
                                rows={3}
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>three emojis that describe you :)</span>
                            <input
                                type="text"
                                name="emojis"
                                maxLength={100}
                                required
                                className={inputClass}
                            />
                        </label>

                        <fieldset className="flex flex-col gap-2 text-[#2c2c2c]">
                            <legend className="mb-1 font-medium">
                                interested in... (select all that apply)
                            </legend>
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
                                <input
                                    type="checkbox"
                                    name="categories"
                                    value="other"
                                    className="size-4 accent-[#7c9272]"
                                />
                                <span>other:</span>
                                <input
                                    type="text"
                                    name="other_category"
                                    maxLength={200}
                                    aria-label="Other category"
                                    className={`${inputClass} min-w-0 flex-1`}
                                />
                            </label>
                        </fieldset>

                        <label className={labelClass}>
                            <span>
                                what are your main pain points with NYC peer-to-peer secondhand exchange?
                            </span>
                            <textarea
                                name="pain_points"
                                maxLength={3000}
                                required
                                rows={4}
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>features you&apos;re dreaming of ...</span>
                            <textarea
                                name="future_features"
                                maxLength={3000}
                                required
                                rows={3}
                                className={inputClass}
                            />
                        </label>

                        <label className={labelClass}>
                            <span>comments, questions, compliments, or concerns ;)</span>
                            <textarea
                                name="misc_thoughts"
                                maxLength={3000}
                                rows={3}
                                className={inputClass}
                            />
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
                        Buy us a coffee {'\u2615'}
                    </a>
                </footer>
            </main>
        </div>
    )
}
