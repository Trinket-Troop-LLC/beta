'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PackagePlus, UserRound } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { compressProfilePicture } from '@/lib/compress-profile-picture'
import { OwnerListingCard, type ListingCardData } from './owner-listing-card'
import { updateProfile } from './profile-actions'
import { formatLastActive } from '@/lib/last-active'

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
    'rounded-lg border border-input bg-card px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'flex flex-col gap-2 text-left text-foreground'
const checkboxLabelClass = 'flex items-center gap-2 text-foreground'

function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return <span className="text-sm text-red-600">{message}</span>
}

export function ProfileSection({
    username,
    preferredName,
    profilePictureUrl,
    lastActive,
    responses,
    listings,
    listingsLoadError,
    initialTab,
}: {
    username: string
    preferredName: string | null
    profilePictureUrl: string | null
    lastActive: string | null
    responses: Responses
    listings: ListingCardData[]
    listingsLoadError: boolean
    initialTab: 'about' | 'listings'
}) {
    const router = useRouter()
    const [tab, setTab] = useState<'about' | 'listings'>(initialTab)
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [isCompressingPhoto, setIsCompressingPhoto] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [deletedListingIds, setDeletedListingIds] = useState<string[]>([])
    const [listingStatusMessage, setListingStatusMessage] = useState<string | null>(null)
    const visibleListings = listings.filter(
        (listing) => !deletedListingIds.includes(listing.id),
    )

    useEffect(() => {
        setTab(initialTab)
    }, [initialTab])

    function selectTab(nextTab: 'about' | 'listings') {
        setTab(nextTab)
        router.replace(`/profile?tab=${nextTab}`, { scroll: false })
    }

    function handleListingDeleted(listingId: string, title: string) {
        setDeletedListingIds((current) => current.includes(listingId)
            ? current
            : [...current, listingId])
        setListingStatusMessage(`“${title}” and all of its photos were permanently deleted.`)
    }

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
                className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
            >
                <div className="flex items-center gap-4">
                    <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
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
                            <UserRound className="size-10 text-muted-foreground" />
                        )}
                    </div>
                    <label className="flex flex-col gap-2 text-foreground">
                        <span className="text-sm font-medium">Profile picture</span>
                        <input
                            type="file"
                            name="profile_pic"
                            accept="image/png,image/jpeg"
                            onChange={handleProfilePicChange}
                            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                        />
                        {isCompressingPhoto && (
                            <span className="text-sm text-muted-foreground">preparing photo...</span>
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

                <fieldset className="flex flex-col gap-2 text-foreground">
                    <legend className="mb-1 text-sm font-medium">Trading categories</legend>
                    {categoryOptions.map((category) => (
                        <label key={category.value} className={checkboxLabelClass}>
                            <input
                                type="checkbox"
                                name="categories"
                                value={category.value}
                                defaultChecked={responses?.categories?.includes(category.value)}
                                className="size-4 accent-primary"
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
                            className="size-4 accent-primary"
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
                        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending ? 'saving...' : 'save'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isPending}
                        className="rounded-lg border border-border px-4 py-2 font-medium text-foreground transition hover:bg-secondary"
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
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-foreground bg-secondary">
                        {profilePictureUrl ? (
                            <Image
                                src={profilePictureUrl}
                                alt={`${username}'s profile picture`}
                                width={80}
                                height={80}
                                className="size-full object-cover"
                            />
                        ) : (
                            <UserRound className="size-8 text-muted-foreground" />
                        )}
                    </div>

                    <div className="pt-1">
                        <p className="text-xl font-semibold text-foreground">{preferredName || username}</p>
                        <p className="text-sm text-muted-foreground">@{username}</p>
                        <p className="text-xs text-muted-foreground">{formatLastActive(lastActive)}</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-foreground transition hover:bg-muted"
                >
                    edit
                </button>
            </div>

            <div className="mb-4 flex">
                <button
                    onClick={() => selectTab('about')}
                    aria-pressed={tab === 'about'}
                    className={`flex-1 border-b-2 pb-2 text-center text-lg font-medium transition ${
                        tab === 'about'
                            ? 'border-foreground text-foreground'
                            : 'border-secondary text-muted-foreground'
                    }`}
                >
                    info
                </button>
                <button
                    onClick={() => selectTab('listings')}
                    aria-pressed={tab === 'listings'}
                    className={`flex-1 border-b-2 pb-2 text-center text-lg font-medium transition ${
                        tab === 'listings'
                            ? 'border-foreground text-foreground'
                            : 'border-secondary text-muted-foreground'
                    }`}
                >
                    trinkets
                </button>
            </div>

            {tab === 'about' ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Neighborhood</p>
                        <p className="text-foreground">{responses?.neighborhood || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Emojis</p>
                        <p className="text-foreground">{responses?.emojis || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Trading categories</p>
                        <p className="text-foreground">
                            {responses?.categories?.length
                                ? responses.categories
                                      .map((category) => categoryLabels[category] ?? category)
                                      .join(', ')
                                : '—'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {listingStatusMessage && (
                        <p
                            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground"
                            role="status"
                        >
                            {listingStatusMessage}
                        </p>
                    )}

                    {listingsLoadError && (
                        <p
                            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            role="alert"
                        >
                            We could not load all of your listings right now. Please refresh and try again.
                        </p>
                    )}

                    {visibleListings.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {visibleListings.map((listing) => (
                                <OwnerListingCard
                                    key={listing.id}
                                    listing={listing}
                                    onDeleted={handleListingDeleted}
                                />
                            ))}
                        </div>
                    ) : !listingsLoadError ? (
                        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                            <PackagePlus className="mx-auto size-8 text-primary" />
                            <p className="mt-3 font-medium text-foreground">No active listings.</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Post a trinket and it will show up here.
                            </p>
                            <Link
                                href="/posts"
                                className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                            >
                                Make a post
                            </Link>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
