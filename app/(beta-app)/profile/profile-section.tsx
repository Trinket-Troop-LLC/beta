'use client'

import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { useState, useTransition } from 'react'
import { compressProfilePicture } from '@/lib/compress-profile-picture'
import { updateProfile } from './profile-actions'

type Responses = {
    neighborhood?: string
    emojis?: string
    categories?: string[]
    other_category?: string
} | null

const categoryOptions = [
    { value: 'true', label: 'true trinkets' },
    { value: 'wearable', label: 'wearable trinkets' },
    { value: 'home', label: 'home trinkets' },
    { value: 'kitchen', label: 'kitchen trinkets' },
    { value: 'outdoorsy', label: 'outdoorsy trinkets' },
    { value: 'hobby', label: 'hobby trinkets' },
]

const categoryLabels: Record<string, string> = {
    true: 'true trinkets',
    wearable: 'wearable trinkets',
    home: 'home trinkets',
    kitchen: 'kitchen trinkets',
    outdoorsy: 'outdoorsy trinkets',
    hobby: 'hobby trinkets',
    other: 'other trinkets',
}

const inputClass =
    'rounded-lg border border-[#d8d1c5] bg-white px-4 py-3 text-black outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20'
const labelClass = 'flex flex-col gap-2 text-left text-[#2c2c2c]'
const checkboxLabelClass = 'flex items-center gap-2 text-[#2c2c2c]'

function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return <span className="text-sm text-red-600">{message}</span>
}

export function ProfileSection({
    username,
    preferredName,
    profilePictureUrl,
    responses,
}: {
    username: string
    preferredName: string | null
    profilePictureUrl: string | null
    responses: Responses
}) {
    const [tab, setTab] = useState<'about' | 'listings'>('about')
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [isCompressingPhoto, setIsCompressingPhoto] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    async function handleProfilePicChange(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const file = input.files?.[0]

        if (!file) return

        setIsCompressingPhoto(true)
        try {
            const compressed = await compressProfilePicture(file)
            const transfer = new DataTransfer()
            transfer.items.add(compressed)
            input.files = transfer.files
            setPreviewUrl(URL.createObjectURL(compressed))
        } catch {
            input.value = ''
            setFieldErrors((prev) => ({
                ...prev,
                profile_pic: 'We could not process that image. Please try a different photo.',
            }))
        } finally {
            setIsCompressingPhoto(false)
        }
    }

    function handleCancel() {
        setIsEditing(false)
        setPreviewUrl(null)
        setError(null)
        setFieldErrors({})
    }

    function handleSubmit(formData: FormData) {
        setError(null)
        setFieldErrors({})

        startTransition(async () => {
            const result = await updateProfile(formData)

            if (result.success) {
                setIsEditing(false)
                setPreviewUrl(null)
            } else {
                setFieldErrors(result.fieldErrors ?? {})
                if (result.error) {
                    setError(result.error)
                }
            }
        })
    }

    if (isEditing) {
        return (
            <form
                action={handleSubmit}
                className="flex flex-col gap-6 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm"
            >
                <div className="flex items-center gap-4">
                    <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                        {previewUrl || profilePictureUrl ? (
                            <Image
                                src={previewUrl ?? profilePictureUrl!}
                                alt="Profile picture preview"
                                width={96}
                                height={96}
                                className="size-full object-cover"
                                unoptimized={Boolean(previewUrl)}
                            />
                        ) : (
                            <UserRound className="size-10 text-[#9aaa90]" />
                        )}
                    </div>
                    <label className="flex flex-col gap-2 text-[#2c2c2c]">
                        <span className="text-sm font-medium">Profile picture</span>
                        <input
                            type="file"
                            name="profile_pic"
                            accept="image/png,image/jpeg"
                            onChange={handleProfilePicChange}
                            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#7c9272] file:px-3 file:py-1.5 file:text-white"
                        />
                        {isCompressingPhoto && (
                            <span className="text-sm text-[#7c8072]">preparing photo...</span>
                        )}
                        <FieldError message={fieldErrors.profile_pic} />
                    </label>
                </div>

                <label className={labelClass}>
                    <span>Preferred name</span>
                    <input
                        type="text"
                        name="preferred_name"
                        defaultValue={preferredName ?? ''}
                        maxLength={100}
                        className={inputClass}
                    />
                    <FieldError message={fieldErrors.preferred_name} />
                </label>

                <label className={labelClass}>
                    <span>Username</span>
                    <input
                        type="text"
                        name="username"
                        defaultValue={username}
                        maxLength={100}
                        required
                        className={inputClass}
                    />
                    <FieldError message={fieldErrors.username} />
                </label>

                <label className={labelClass}>
                    <span>Neighborhood</span>
                    <textarea
                        name="neighborhood"
                        defaultValue={responses?.neighborhood ?? ''}
                        maxLength={2000}
                        rows={3}
                        className={inputClass}
                    />
                    <FieldError message={fieldErrors.neighborhood} />
                </label>

                <label className={labelClass}>
                    <span>Emojis</span>
                    <input
                        type="text"
                        name="emojis"
                        defaultValue={responses?.emojis ?? ''}
                        maxLength={100}
                        className={inputClass}
                    />
                    <FieldError message={fieldErrors.emojis} />
                </label>

                <fieldset className="flex flex-col gap-2 text-[#2c2c2c]">
                    <legend className="mb-1 text-sm font-medium">Trading categories</legend>
                    {categoryOptions.map((category) => (
                        <label key={category.value} className={checkboxLabelClass}>
                            <input
                                type="checkbox"
                                name="categories"
                                value={category.value}
                                defaultChecked={responses?.categories?.includes(category.value)}
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
                            defaultChecked={responses?.categories?.includes('other')}
                            className="size-4 accent-[#7c9272]"
                        />
                        <span>other:</span>
                        <input
                            type="text"
                            name="other_category"
                            defaultValue={responses?.other_category ?? ''}
                            maxLength={200}
                            aria-label="Other category"
                            className={`${inputClass} min-w-0 flex-1`}
                        />
                    </label>
                    <FieldError message={fieldErrors.categories} />
                    <FieldError message={fieldErrors.other_category} />
                </fieldset>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={isPending || isCompressingPhoto}
                        className="rounded-lg bg-[#7c9272] px-4 py-2 font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending ? 'saving...' : 'save'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isPending}
                        className="rounded-lg border border-[#ded8cc] px-4 py-2 font-medium text-[#2c2c2c] transition hover:bg-[#f5efe5]"
                    >
                        cancel
                    </button>
                </div>

                {error && (
                    <p className="text-sm text-red-600" role="alert">
                        {error}
                    </p>
                )}
            </form>
        )
    }

    return (
        <div>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 text-left">
                    <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                        {profilePictureUrl ? (
                            <Image
                                src={profilePictureUrl}
                                alt={`${username}'s profile picture`}
                                width={128}
                                height={128}
                                className="size-full object-cover"
                            />
                        ) : (
                            <UserRound className="size-12 text-[#9aaa90]" />
                        )}
                    </div>

                    <div className="pt-1">
                        <p className="text-xl font-semibold text-[#30392d]">@{username}</p>
                        {preferredName && (
                            <p className="text-sm text-[#7c8072]">{preferredName}</p>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 rounded-full border border-[#ded8cc] bg-[#fffdf9] px-4 py-2 text-sm font-medium text-[#2c2c2c] transition hover:bg-[#f5efe5]"
                >
                    Edit
                </button>
            </div>

            <div className="mb-4 flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
                    onClick={() => setTab('about')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'about'
                            ? 'bg-[#7c9272] text-white'
                            : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    About
                </button>
                <button
                    onClick={() => setTab('listings')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'listings'
                            ? 'bg-[#7c9272] text-white'
                            : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Listings
                </button>
            </div>

            {tab === 'about' ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <div>
                        <p className="text-sm font-medium text-[#7c8072]">Neighborhood</p>
                        <p className="text-[#2c2c2c]">{responses?.neighborhood || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-[#7c8072]">Emojis</p>
                        <p className="text-[#2c2c2c]">{responses?.emojis || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-[#7c8072]">Trading categories</p>
                        <p className="text-[#2c2c2c]">
                            {responses?.categories?.length
                                ? responses.categories
                                      .map((category) => categoryLabels[category] ?? category)
                                      .join(', ')
                                : '—'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <p className="text-sm text-[#625f58]">No listings yet.</p>
                </div>
            )}
        </div>
    )
}
