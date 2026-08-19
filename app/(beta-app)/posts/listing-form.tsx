'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Images, LoaderCircle } from 'lucide-react'
import { compressListingPhoto } from '@/lib/compress-image'
import {
    LISTING_CATEGORIES,
    LISTING_CATEGORY_LABELS,
    LISTING_CONDITIONS,
    LISTING_CONDITION_LABELS,
    LISTING_TRANSACTION_TYPES,
    LISTING_TRANSACTION_TYPE_LABELS,
    type ListingTransactionType,
} from '@/lib/listings/domain'
import {
    createPostingError,
    type PostingError,
} from '@/lib/listings/posting-errors'
import { createClient } from '@/lib/supabase/client'
import {
    createListingDraft,
    discardListingDraft,
    finalizeListing,
} from './actions'

const listingPhotosBucket = 'listing-photos'
const maxPhotoCount = 5
const maxOriginalPhotoBytes = 20 * 1024 * 1024
const maxCompressedPhotoBytes = 5 * 1024 * 1024
const pendingDraftStorageKey = 'trinket-troop:pending-listing-draft'

const inputClass =
    'rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'flex flex-col gap-2 text-left text-foreground'

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null
    return <span id={id} className="text-sm text-destructive">{message}</span>
}

class PostingFlowError extends Error {
    reason: PostingError

    constructor(reason: PostingError) {
        super(reason.message)
        this.name = 'PostingFlowError'
        this.reason = reason
    }
}

function getSafePhotoName(file: File) {
    const name = file.name.trim()
    if (!name) return ''
    return name.length > 48 ? `${name.slice(0, 45)}...` : name
}

function getPhotoLabel(index: number, file?: File) {
    const name = file ? getSafePhotoName(file) : ''
    return name ? `Photo ${index + 1} (${name})` : `Photo ${index + 1}`
}

function mapPhotoUploadError(error: unknown, index: number): PostingError {
    const providerError = typeof error === 'object' && error !== null
        ? error as { status?: number; statusCode?: string; message?: string }
        : {}
    const status = providerError.status ?? Number(providerError.statusCode)
    const statusCode = providerError.statusCode?.toLowerCase() ?? ''
    const message = providerError.message?.toLowerCase() ?? ''
    const photo = `Photo ${index + 1}`

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return createPostingError(
            'PHOTO_UPLOAD_UNAVAILABLE',
            `${photo} could not upload because this device is offline. Reconnect and submit again.`,
            true,
        )
    }

    if (status === 401) {
        return createPostingError(
            'UPLOAD_SESSION_EXPIRED',
            `Your session expired before ${photo.toLowerCase()} uploaded. Sign in and submit the listing again.`,
            true,
        )
    }

    if (status === 403) {
        return createPostingError(
            'POSTING_PERMISSION_DENIED',
            `${photo} was refused by listing photo permissions. Sign in and submit it once more; if this continues, ask an administrator to check the listing-photo upload policy.`,
            true,
        )
    }

    if (status === 404 || message.includes('bucket not found')) {
        return createPostingError(
            'PHOTO_STORAGE_SETUP_REQUIRED',
            'Listing photo storage has not been set up yet. Ask an administrator to apply the posting migration.',
        )
    }

    if (status === 409 || statusCode.includes('duplicate')) {
        return createPostingError(
            'PHOTO_UPLOAD_CONFLICT',
            `${photo}'s upload slot was already used. Nothing was posted; submit the form again.`,
            true,
        )
    }

    if (status === 413 || statusCode.includes('too_large') || message.includes('too large')) {
        return createPostingError(
            'PHOTO_OUTPUT_TOO_LARGE',
            `${photo} exceeds the 5 MB upload limit after resizing. Choose a smaller image.`,
        )
    }

    if (status === 415 || message.includes('mime') || message.includes('content type')) {
        return createPostingError(
            'PHOTO_TYPE_UNSUPPORTED',
            `${photo} was rejected because it is not a valid JPEG after processing. Choose another image.`,
        )
    }

    if (status === 429) {
        return createPostingError(
            'PHOTO_UPLOAD_RATE_LIMITED',
            `Too many photo uploads were attempted. ${photo} was not uploaded; wait a moment and submit again.`,
            true,
        )
    }

    return createPostingError(
        'PHOTO_UPLOAD_UNAVAILABLE',
        `${photo} could not upload because the photo service is unavailable. Check your connection and submit again.`,
        true,
    )
}

function combineWithCleanupError(
    primary: PostingError,
    cleanup: PostingError | null,
) {
    if (!cleanup) return primary

    return createPostingError(
        primary.code,
        `${primary.message} We also could not clear the previous attempt: ${cleanup.message}`,
        primary.retryable || cleanup.retryable,
    )
}

export function ListingForm() {
    const router = useRouter()
    const [category, setCategory] = useState('')
    const [transactionTypes, setTransactionTypes] = useState<ListingTransactionType[]>([])
    const [photos, setPhotos] = useState<File[]>([])
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [error, setError] = useState<PostingError | null>(null)
    const [isPreparingPhotos, setIsPreparingPhotos] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [progress, setProgress] = useState<string | null>(null)
    const mounted = useRef(true)
    const pendingDraftId = useRef<string | null>(null)
    const errorSummaryRef = useRef<HTMLDivElement | null>(null)
    const fieldErrorMessages = [...new Set(Object.values(fieldErrors).filter(Boolean))]
    const summaryFieldMessages = fieldErrorMessages.filter(
        (message) => message !== error?.message,
    )
    const hasErrors = Boolean(error) || fieldErrorMessages.length > 0
    const errorSummaryKey = [error?.code, error?.message, ...fieldErrorMessages].join('|')

    useEffect(() => {
        mounted.current = true

        try {
            pendingDraftId.current = sessionStorage.getItem(pendingDraftStorageKey)
        } catch {
            pendingDraftId.current = null
        }

        return () => {
            mounted.current = false
        }
    }, [])

    useEffect(() => {
        return () => {
            photoPreviews.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [photoPreviews])

    useEffect(() => {
        if (hasErrors) {
            errorSummaryRef.current?.focus()
        }
    }, [errorSummaryKey, hasErrors])

    function replacePreparedPhotos(prepared: File[]) {
        setPhotos(prepared)
        setPhotoPreviews(prepared.map((photo) => URL.createObjectURL(photo)))
    }

    async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const selected = Array.from(input.files ?? [])

        setFieldErrors((current) => ({ ...current, photos: '' }))
        setError(null)

        if (selected.length === 0) {
            return
        }

        if (selected.length > maxPhotoCount) {
            input.value = ''
            setFieldErrors((current) => ({
                ...current,
                photos: `Choose no more than ${maxPhotoCount} photos.`,
            }))
            return
        }

        setIsPreparingPhotos(true)

        try {
            if (typeof createImageBitmap !== 'function') {
                throw new PostingFlowError(createPostingError(
                    'PHOTO_PROCESSING_UNSUPPORTED',
                    'This browser cannot prepare listing photos. Update it or use another browser.',
                ))
            }

            const prepared: File[] = []

            for (const [index, photo] of selected.entries()) {
                const photoLabel = getPhotoLabel(index, photo)

                if (photo.type !== 'image/jpeg' && photo.type !== 'image/png') {
                    throw new PostingFlowError(createPostingError(
                        'PHOTO_TYPE_UNSUPPORTED',
                        `${photoLabel} is not a PNG or JPEG image. Choose a JPG or PNG file.`,
                    ))
                }

                if (photo.size > maxOriginalPhotoBytes) {
                    throw new PostingFlowError(createPostingError(
                        'PHOTO_ORIGINAL_TOO_LARGE',
                        `${photoLabel} is larger than the 20 MB selection limit. Choose a smaller file.`,
                    ))
                }

                let compressed: File

                try {
                    compressed = await compressListingPhoto(photo)
                } catch (compressionError) {
                    if (
                        compressionError instanceof Error
                        && compressionError.message === 'Canvas is not supported'
                    ) {
                        throw new PostingFlowError(createPostingError(
                            'PHOTO_PROCESSING_UNSUPPORTED',
                            'This browser cannot prepare listing photos. Update it or use another browser.',
                        ))
                    }

                    throw new PostingFlowError(createPostingError(
                        'PHOTO_PROCESSING_FAILED',
                        `${photoLabel} could not be opened or resized. Choose a valid, uncorrupted JPG or PNG.`,
                    ))
                }

                if (compressed.size > maxCompressedPhotoBytes) {
                    throw new PostingFlowError(createPostingError(
                        'PHOTO_OUTPUT_TOO_LARGE',
                        `${photoLabel} is still larger than 5 MB after resizing. Choose a smaller image.`,
                    ))
                }

                prepared.push(compressed)
            }

            replacePreparedPhotos(prepared)
        } catch (photoError) {
            input.value = ''
            const reason = photoError instanceof PostingFlowError
                ? photoError.reason
                : createPostingError(
                    'PHOTO_PROCESSING_FAILED',
                    'The selected photos could not be prepared. Choose valid JPG or PNG files and try again.',
                )
            setFieldErrors((current) => ({
                ...current,
                photos: reason.message,
            }))
        } finally {
            setIsPreparingPhotos(false)
        }
    }

    function toggleTransactionType(type: ListingTransactionType, checked: boolean) {
        setTransactionTypes((current) => checked
            ? [...current, type]
            : current.filter((currentType) => currentType !== type))
    }

    async function tryDiscardDraft(listingId: string) {
        try {
            return await discardListingDraft(listingId)
        } catch {
            return null
        }
    }

    function rememberPendingDraft(listingId: string | null) {
        pendingDraftId.current = listingId

        try {
            if (listingId) {
                sessionStorage.setItem(pendingDraftStorageKey, listingId)
            } else {
                sessionStorage.removeItem(pendingDraftStorageKey)
            }
        } catch {
            // The in-memory reference still lets this mounted form retry cleanup.
        }
    }

    function finishWithError(reason: PostingError) {
        if (!mounted.current) return
        setError(reason)
        setIsSubmitting(false)
        setProgress(null)
    }

    function finishPublishedPost() {
        rememberPendingDraft(null)
        if (!mounted.current) return
        router.replace('/profile?tab=listings')
        router.refresh()
    }

    async function finishRejectedDraft(listingId: string, primary: PostingError) {
        const cleanupResult = await tryDiscardDraft(listingId)

        if (cleanupResult?.success && cleanupResult.state === 'published') {
            finishPublishedPost()
            return
        }

        if (cleanupResult?.success) {
            rememberPendingDraft(null)
            finishWithError(primary)
            return
        }

        const cleanupError = cleanupResult?.error ?? createPostingError(
            'CLEANUP_UNAVAILABLE',
            'The listing service did not respond while clearing the previous attempt. Wait a moment before posting again.',
            true,
        )

        finishWithError(combineWithCleanupError(primary, cleanupError))
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)

        setError(null)
        setFieldErrors({})

        if (photos.length < 1 || photos.length > maxPhotoCount) {
            setFieldErrors({
                photos: photos.length < 1
                    ? 'Choose at least one photo.'
                    : `Choose no more than ${maxPhotoCount} photos.`,
            })
            setError(createPostingError(
                'PHOTO_COUNT_INVALID',
                'This listing was not posted because it needs between 1 and 5 photos.',
            ))
            return
        }

        setIsSubmitting(true)
        setProgress('starting your post...')

        if (pendingDraftId.current) {
            const previousDraftId = pendingDraftId.current
            setProgress('cleaning up the previous attempt...')
            const previousCleanup = await tryDiscardDraft(previousDraftId)

            if (previousCleanup?.success && previousCleanup.state === 'published') {
                finishPublishedPost()
                return
            }

            if (!previousCleanup?.success) {
                finishWithError(
                    previousCleanup?.error ?? createPostingError(
                        'CLEANUP_UNAVAILABLE',
                        'The previous posting attempt could not be cleared because the listing service did not respond. Wait a moment and try again.',
                        true,
                    ),
                )
                return
            }

            rememberPendingDraft(null)
            setProgress('starting your post...')
        }

        let draftResult: Awaited<ReturnType<typeof createListingDraft>>

        try {
            draftResult = await createListingDraft(formData, photos.length)
        } catch {
            finishWithError(createPostingError(
                'CONNECTION_FAILED',
                'The posting service did not respond, so no listing was created. Check your connection and try again.',
                true,
            ))
            return
        }

        if (!draftResult.success) {
            if (mounted.current) {
                setFieldErrors(draftResult.fieldErrors ?? {})
                setError(draftResult.error ?? createPostingError(
                    'LISTING_DETAILS_REJECTED',
                    'This listing was not posted because some highlighted details need to be corrected.',
                ))
                setIsSubmitting(false)
                setProgress(null)
            }
            return
        }

        rememberPendingDraft(draftResult.listingId)

        try {
            const db = createClient()

            if (draftResult.photoPaths.length !== photos.length) {
                throw new PostingFlowError(createPostingError(
                    'PHOTO_SLOT_MISMATCH',
                    `The service prepared ${draftResult.photoPaths.length} photo uploads, but ${photos.length} photos were selected. Nothing was posted; submit again.`,
                    true,
                ))
            }

            for (const [index, photo] of photos.entries()) {
                if (mounted.current) {
                    setProgress(`uploading photo ${index + 1} of ${photos.length}...`)
                }

                const { error: uploadError } = await db.storage
                    .from(listingPhotosBucket)
                    .upload(draftResult.photoPaths[index], photo, {
                        cacheControl: '3600',
                        contentType: 'image/jpeg',
                        upsert: false,
                    })

                if (uploadError) {
                    throw new PostingFlowError(mapPhotoUploadError(uploadError, index))
                }
            }
        } catch (uploadError) {
            const reason = uploadError instanceof PostingFlowError
                ? uploadError.reason
                : createPostingError(
                    'PHOTO_UPLOAD_UNAVAILABLE',
                    'The photo upload could not start because the photo service did not respond. Check your connection and submit again.',
                    true,
                )
            await finishRejectedDraft(draftResult.listingId, reason)
            return
        }

        if (mounted.current) {
            setProgress('publishing your post...')
        }

        let publishResult: Awaited<ReturnType<typeof finalizeListing>>

        try {
            publishResult = await finalizeListing(draftResult.listingId)
        } catch {
            await finishRejectedDraft(
                draftResult.listingId,
                createPostingError(
                    'PUBLISH_UNAVAILABLE',
                    'The posting service stopped responding while confirming publication. Check My Listings before submitting again.',
                    true,
                ),
            )
            return
        }

        if (!publishResult.success) {
            await finishRejectedDraft(draftResult.listingId, publishResult.error)
            return
        }

        finishPublishedPost()
    }

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={isSubmitting || isPreparingPhotos}
            className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"
        >
            <fieldset
                disabled={isSubmitting || isPreparingPhotos}
                className="contents"
            >
            {hasErrors && (
                <div
                    ref={errorSummaryRef}
                    tabIndex={-1}
                    role="alert"
                    aria-live="assertive"
                    className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-left outline-none focus:ring-2 focus:ring-destructive/40"
                >
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div className="min-w-0">
                        <p className="font-semibold text-destructive">
                            {error ? 'Listing wasn’t posted' : 'Fix these details before posting'}
                        </p>
                        {error && (
                            <p className="mt-1 text-sm text-foreground">{error.message}</p>
                        )}
                        {summaryFieldMessages.length > 0 && (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                                {summaryFieldMessages.map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                            Your entered details were preserved. Any previously prepared photos are still here.
                        </p>
                    </div>
                </div>
            )}

            <fieldset className="flex flex-col gap-3 text-left">
                <legend className="font-medium text-foreground">Photos *</legend>
                <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/60 px-4 py-8 text-center transition hover:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2">
                    <Images className="size-6 text-primary" />
                    <span>
                        <span className="block font-medium text-foreground">
                            {photos.length > 0 ? 'Choose different photos' : 'Choose 1–5 photos'}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                            PNG or JPEG; the first photo will be the cover
                        </span>
                    </span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg"
                        multiple
                        disabled={isPreparingPhotos || isSubmitting}
                        onChange={handlePhotoChange}
                        aria-invalid={Boolean(fieldErrors.photos)}
                        aria-describedby={fieldErrors.photos ? 'listing-photos-error' : undefined}
                        className="sr-only"
                    />
                </label>

                {isPreparingPhotos && (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        preparing photos...
                    </span>
                )}

                {photoPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {photoPreviews.map((url, index) => (
                            <div
                                key={url}
                                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                            >
                                <Image
                                    src={url}
                                    alt={`Listing photo ${index + 1} preview`}
                                    fill
                                    sizes="(max-width: 640px) 30vw, 120px"
                                    className="object-cover"
                                    unoptimized
                                />
                                {index === 0 && (
                                    <span className="absolute bottom-1 left-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-medium text-background">
                                        cover
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <FieldError id="listing-photos-error" message={fieldErrors.photos} />
            </fieldset>

            <label className={labelClass}>
                <span className="font-medium">Title *</span>
                <input
                    type="text"
                    name="title"
                    maxLength={120}
                    required
                    placeholder="Vintage strawberry lamp"
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={fieldErrors.title ? 'listing-title-error' : undefined}
                    className={inputClass}
                />
                <FieldError id="listing-title-error" message={fieldErrors.title} />
            </label>

            <label className={labelClass}>
                <span className="font-medium">Description *</span>
                <textarea
                    name="description"
                    maxLength={3000}
                    rows={5}
                    required
                    placeholder="Share the story, size, quirks, and anything someone should know."
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={fieldErrors.description ? 'listing-description-error' : undefined}
                    className={inputClass}
                />
                <FieldError id="listing-description-error" message={fieldErrors.description} />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>
                    <span className="font-medium">Category *</span>
                    <select
                        name="category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        required
                        aria-invalid={Boolean(fieldErrors.category)}
                        aria-describedby={fieldErrors.category ? 'listing-category-error' : undefined}
                        className={inputClass}
                    >
                        <option value="" disabled>Choose a category</option>
                        {LISTING_CATEGORIES.map((option) => (
                            <option key={option} value={option}>
                                {LISTING_CATEGORY_LABELS[option]}
                            </option>
                        ))}
                    </select>
                    <FieldError id="listing-category-error" message={fieldErrors.category} />
                </label>

                <label className={labelClass}>
                    <span className="font-medium">Condition *</span>
                    <select
                        name="condition"
                        defaultValue=""
                        required
                        aria-invalid={Boolean(fieldErrors.condition)}
                        aria-describedby={fieldErrors.condition ? 'listing-condition-error' : undefined}
                        className={inputClass}
                    >
                        <option value="" disabled>Choose a condition</option>
                        {LISTING_CONDITIONS.map((condition) => (
                            <option key={condition} value={condition}>
                                {LISTING_CONDITION_LABELS[condition]}
                            </option>
                        ))}
                    </select>
                    <FieldError id="listing-condition-error" message={fieldErrors.condition} />
                </label>
            </div>

            {category === 'other' && (
                <label className={labelClass}>
                    <span className="font-medium">Other category *</span>
                    <input
                        type="text"
                        name="other_category"
                        maxLength={100}
                        required
                        placeholder="What kind of trinket is it?"
                        aria-invalid={Boolean(fieldErrors.other_category)}
                        aria-describedby={fieldErrors.other_category ? 'listing-other-category-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="listing-other-category-error" message={fieldErrors.other_category} />
                </label>
            )}

            <fieldset
                aria-describedby={fieldErrors.transaction_types ? 'listing-transaction-types-error' : undefined}
                className="flex flex-col gap-3 text-left text-foreground"
            >
                <legend className="font-medium">How would you like to share it? *</legend>
                <div className="grid grid-cols-2 gap-2">
                    {LISTING_TRANSACTION_TYPES.map((type) => (
                        <label
                            key={type}
                            className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 ${
                                transactionTypes.includes(type)
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-card hover:bg-secondary'
                            }`}
                        >
                            <input
                                type="checkbox"
                                name="transaction_types"
                                value={type}
                                checked={transactionTypes.includes(type)}
                                onChange={(event) => toggleTransactionType(type, event.target.checked)}
                                aria-invalid={Boolean(fieldErrors.transaction_types)}
                                className="sr-only"
                            />
                            {LISTING_TRANSACTION_TYPE_LABELS[type]}
                        </label>
                    ))}
                </div>
                <FieldError
                    id="listing-transaction-types-error"
                    message={fieldErrors.transaction_types}
                />
            </fieldset>

            {transactionTypes.includes('sell') && (
                <label className={labelClass}>
                    <span className="font-medium">Price *</span>
                    <div className="flex items-center rounded-xl border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                        <span className="pl-4 text-muted-foreground">$</span>
                        <input
                            type="text"
                            name="price"
                            inputMode="decimal"
                            pattern="\d+(\.\d{1,2})?"
                            required
                            placeholder="25.00"
                            aria-invalid={Boolean(fieldErrors.price)}
                            aria-describedby={fieldErrors.price ? 'listing-price-error' : undefined}
                            className="min-w-0 flex-1 bg-transparent px-2 py-3 text-foreground outline-none"
                        />
                    </div>
                    <FieldError id="listing-price-error" message={fieldErrors.price} />
                </label>
            )}

            <label className={labelClass}>
                <span className="font-medium">Pickup area *</span>
                <input
                    type="text"
                    name="pickup_area"
                    maxLength={150}
                    required
                    placeholder="Neighborhood or general meeting area—never an exact address"
                    aria-invalid={Boolean(fieldErrors.pickup_area)}
                    aria-describedby={fieldErrors.pickup_area ? 'listing-pickup-area-error' : undefined}
                    className={inputClass}
                />
                <FieldError id="listing-pickup-area-error" message={fieldErrors.pickup_area} />
            </label>

            {progress && (
                <span className="sr-only" aria-live="polite">{progress}</span>
            )}

            <button
                type="submit"
                disabled={isSubmitting || isPreparingPhotos}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {(isSubmitting || isPreparingPhotos) && <LoaderCircle className="size-4 animate-spin" />}
                {progress ?? (isPreparingPhotos ? 'preparing photos...' : 'post listing')}
            </button>
            </fieldset>
        </form>
    )
}
