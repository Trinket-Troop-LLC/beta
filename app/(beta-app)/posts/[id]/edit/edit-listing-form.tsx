'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Images, LoaderCircle, MoveDown, MoveUp, X } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'
import { updateListingDetails, updateListingPhotos, verifyListingPhotoEdit } from '../../edit-actions'

const listingPhotosBucket = 'listing-photos'
const maxPhotoCount = 5
const maxOriginalPhotoBytes = 20 * 1024 * 1024
const maxCompressedPhotoBytes = 5 * 1024 * 1024

const inputClass =
    'rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'flex flex-col gap-2 text-left text-foreground'

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null
    return <span id={id} className="text-sm text-destructive">{message}</span>
}

type ExistingPhoto = { id: string; url: string | null }

export function EditListingForm({
    listingId,
    initialValues,
    initialPhotos,
}: {
    listingId: string
    initialValues: {
        title: string
        description: string
        category: string
        other_category: string
        nuance: string
        condition: string
        transaction_types: string[]
        price: string
        pickup_area: string
    }
    initialPhotos: ExistingPhoto[]
}) {
    const router = useRouter()
    const [category, setCategory] = useState(initialValues.category)
    const [transactionTypes, setTransactionTypes] = useState<ListingTransactionType[]>(
        initialValues.transaction_types as ListingTransactionType[],
    )
    const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(initialPhotos)
    const [newPhotos, setNewPhotos] = useState<File[]>([])
    const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([])
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [error, setError] = useState<string | null>(null)
    const [isPreparingPhotos, setIsPreparingPhotos] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [progress, setProgress] = useState<string | null>(null)
    const errorSummaryRef = useRef<HTMLDivElement | null>(null)
    const totalPhotoCount = existingPhotos.length + newPhotos.length

    function moveExistingPhoto(index: number, direction: -1 | 1) {
        setExistingPhotos((current) => {
            const next = [...current]
            const target = index + direction
            if (target < 0 || target >= next.length) return current
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })
    }

    function removeExistingPhoto(id: string) {
        setExistingPhotos((current) => current.filter((photo) => photo.id !== id))
    }

    function removeNewPhoto(index: number) {
        setNewPhotos((current) => current.filter((_, i) => i !== index))
        setNewPhotoPreviews((current) => {
            URL.revokeObjectURL(current[index])
            return current.filter((_, i) => i !== index)
        })
    }

    async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const selected = Array.from(input.files ?? [])

        setFieldErrors((current) => ({ ...current, photos: '' }))
        setError(null)

        if (selected.length === 0) return

        if (existingPhotos.length + newPhotos.length + selected.length > maxPhotoCount) {
            input.value = ''
            setFieldErrors((current) => ({
                ...current,
                photos: `Choose no more than ${maxPhotoCount} photos in total.`,
            }))
            return
        }

        setIsPreparingPhotos(true)

        try {
            if (typeof createImageBitmap !== 'function') {
                throw new Error('This browser cannot prepare listing photos. Update it or use another browser.')
            }

            const prepared: File[] = []

            for (const photo of selected) {
                if (photo.type !== 'image/jpeg' && photo.type !== 'image/png') {
                    throw new Error(`${photo.name || 'That photo'} is not a PNG or JPEG image.`)
                }
                if (photo.size > maxOriginalPhotoBytes) {
                    throw new Error(`${photo.name || 'That photo'} is larger than the 20 MB selection limit.`)
                }

                let compressed: File
                try {
                    compressed = await compressListingPhoto(photo)
                } catch {
                    throw new Error(`${photo.name || 'That photo'} could not be opened or resized.`)
                }

                if (compressed.size > maxCompressedPhotoBytes) {
                    throw new Error(`${photo.name || 'That photo'} is still larger than 5 MB after resizing.`)
                }

                prepared.push(compressed)
            }

            setNewPhotos((current) => [...current, ...prepared])
            setNewPhotoPreviews((current) => [...current, ...prepared.map((photo) => URL.createObjectURL(photo))])
        } catch (photoError) {
            input.value = ''
            setFieldErrors((current) => ({
                ...current,
                photos: photoError instanceof Error ? photoError.message : 'The selected photos could not be prepared.',
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

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)

        setError(null)
        setFieldErrors({})
        setIsSubmitting(true)
        setProgress('saving details...')

        const detailsResult = await updateListingDetails(listingId, formData)

        if (!detailsResult.success) {
            setFieldErrors(detailsResult.fieldErrors ?? {})
            setError(detailsResult.error ?? 'Some details need to be corrected.')
            setIsSubmitting(false)
            setProgress(null)
            errorSummaryRef.current?.focus()
            return
        }

        setProgress('saving photos...')

        const photosResult = await updateListingPhotos(
            listingId,
            existingPhotos.map((photo) => photo.id),
            newPhotos.length,
        )

        if (!photosResult.success) {
            setError(photosResult.error)
            setIsSubmitting(false)
            setProgress(null)
            errorSummaryRef.current?.focus()
            return
        }

        if (newPhotos.length > 0) {
            const db = createClient()

            for (const [index, photo] of newPhotos.entries()) {
                setProgress(`uploading photo ${index + 1} of ${newPhotos.length}...`)

                const { error: uploadError } = await db.storage
                    .from(listingPhotosBucket)
                    .upload(photosResult.newPhotoPaths[index], photo, {
                        cacheControl: '3600',
                        contentType: 'image/jpeg',
                        upsert: false,
                    })

                if (uploadError) {
                    setError('One of your new photos could not upload. Please try again.')
                    setIsSubmitting(false)
                    setProgress(null)
                    errorSummaryRef.current?.focus()
                    return
                }
            }

            setProgress('checking new photos...')
            const verifyResult = await verifyListingPhotoEdit(listingId, photosResult.newPhotoPaths)

            if (!verifyResult.success) {
                setError(verifyResult.error ?? 'Could not verify your new photos.')
                setIsSubmitting(false)
                setProgress(null)
                errorSummaryRef.current?.focus()
                return
            }
        }

        router.push(`/troop/listings/${listingId}`)
        router.refresh()
    }

    const fieldErrorMessages = [...new Set(Object.values(fieldErrors).filter(Boolean))]
    const hasErrors = Boolean(error) || fieldErrorMessages.length > 0

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={isSubmitting || isPreparingPhotos}
            className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"
        >
            <fieldset disabled={isSubmitting || isPreparingPhotos} className="contents">
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
                            <p className="font-semibold text-destructive">Changes weren&apos;t saved</p>
                            {error && <p className="mt-1 text-sm text-foreground">{error}</p>}
                            {fieldErrorMessages.length > 0 && (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                                    {fieldErrorMessages.map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                <fieldset className="flex flex-col gap-3 text-left">
                    <legend className="font-medium text-foreground">Photos</legend>

                    {existingPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {existingPhotos.map((photo, index) => (
                                <div
                                    key={photo.id}
                                    className="relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                                >
                                    {photo.url && (
                                        <Image
                                            src={photo.url}
                                            alt={`Listing photo ${index + 1}`}
                                            fill
                                            sizes="(max-width: 640px) 30vw, 120px"
                                            className="object-cover"
                                        />
                                    )}
                                    {index === 0 && (
                                        <span className="absolute bottom-1 left-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-medium text-background">
                                            cover
                                        </span>
                                    )}
                                    <div className="absolute right-1 top-1 flex gap-1">
                                        {index > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => moveExistingPhoto(index, -1)}
                                                aria-label="Move photo earlier"
                                                className="flex size-6 items-center justify-center rounded-full bg-foreground/80 text-background"
                                            >
                                                <MoveUp className="size-3.5" />
                                            </button>
                                        )}
                                        {index < existingPhotos.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => moveExistingPhoto(index, 1)}
                                                aria-label="Move photo later"
                                                className="flex size-6 items-center justify-center rounded-full bg-foreground/80 text-background"
                                            >
                                                <MoveDown className="size-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeExistingPhoto(photo.id)}
                                            aria-label="Remove photo"
                                            className="flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {newPhotoPreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {newPhotoPreviews.map((url, index) => (
                                <div
                                    key={url}
                                    className="relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                                >
                                    <Image
                                        src={url}
                                        alt={`New photo ${index + 1} preview`}
                                        fill
                                        sizes="(max-width: 640px) 30vw, 120px"
                                        className="object-cover"
                                        unoptimized
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeNewPhoto(index)}
                                        aria-label="Remove new photo"
                                        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {totalPhotoCount < maxPhotoCount && (
                        <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/60 px-4 py-8 text-center transition hover:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2">
                            <Images className="size-6 text-primary" />
                            <span>
                                <span className="block font-medium text-foreground">Add photos</span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                    PNG or JPEG, up to {maxPhotoCount - totalPhotoCount} more. Without any, a category icon is shown instead.
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
                    )}

                    {isPreparingPhotos && (
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" />
                            preparing photos...
                        </span>
                    )}
                    <FieldError id="listing-photos-error" message={fieldErrors.photos} />
                </fieldset>

                <label className={labelClass}>
                    <span className="font-medium">Title *</span>
                    <input
                        type="text"
                        name="title"
                        defaultValue={initialValues.title}
                        maxLength={120}
                        required
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
                        defaultValue={initialValues.description}
                        maxLength={3000}
                        rows={5}
                        required
                        aria-invalid={Boolean(fieldErrors.description)}
                        aria-describedby={fieldErrors.description ? 'listing-description-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="listing-description-error" message={fieldErrors.description} />
                </label>

                <label className={labelClass}>
                    <span className="font-medium">Nuance box</span>
                    <textarea
                        name="nuance"
                        defaultValue={initialValues.nuance}
                        maxLength={500}
                        rows={2}
                        placeholder="Any quirky detail that doesn't fit above."
                        aria-invalid={Boolean(fieldErrors.nuance)}
                        aria-describedby={fieldErrors.nuance ? 'listing-nuance-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="listing-nuance-error" message={fieldErrors.nuance} />
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
                            defaultValue={initialValues.condition}
                            required
                            aria-invalid={Boolean(fieldErrors.condition)}
                            aria-describedby={fieldErrors.condition ? 'listing-condition-error' : undefined}
                            className={inputClass}
                        >
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
                            defaultValue={initialValues.other_category}
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
                    <FieldError id="listing-transaction-types-error" message={fieldErrors.transaction_types} />
                </fieldset>

                {transactionTypes.includes('sell') && (
                    <label className={labelClass}>
                        <span className="font-medium">Price *</span>
                        <div className="flex items-center rounded-xl border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                            <span className="pl-4 text-muted-foreground">$</span>
                            <input
                                type="text"
                                name="price"
                                defaultValue={initialValues.price}
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
                        defaultValue={initialValues.pickup_area}
                        maxLength={150}
                        required
                        placeholder="Neighborhood or general meeting area—never an exact address"
                        aria-invalid={Boolean(fieldErrors.pickup_area)}
                        aria-describedby={fieldErrors.pickup_area ? 'listing-pickup-area-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="listing-pickup-area-error" message={fieldErrors.pickup_area} />
                </label>

                {progress && <span className="sr-only" aria-live="polite">{progress}</span>}

                <button
                    type="submit"
                    disabled={isSubmitting || isPreparingPhotos}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {(isSubmitting || isPreparingPhotos) && <LoaderCircle className="size-4 animate-spin" />}
                    {progress ?? (isPreparingPhotos ? 'preparing photos...' : 'save changes')}
                </button>
            </fieldset>
        </form>
    )
}
