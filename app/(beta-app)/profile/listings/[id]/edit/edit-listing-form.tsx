'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { Images, LoaderCircle } from 'lucide-react'
import {
    LISTING_CATEGORIES,
    LISTING_CATEGORY_LABELS,
    LISTING_CONDITIONS,
    LISTING_CONDITION_LABELS,
    LISTING_TRANSACTION_TYPES,
    LISTING_TRANSACTION_TYPE_LABELS,
    type ListingCategory,
    type ListingCondition,
    type ListingTransactionType,
} from '@/lib/listings/domain'
import { updateListingDetails } from '@/app/(beta-app)/posts/actions'

export type EditableListingDetails = {
    id: string
    title: string
    description: string
    category: ListingCategory
    other_category: string | null
    condition: ListingCondition
    transaction_types: ListingTransactionType[]
    price_cents: number | null
    pickup_area: string
}

const inputClass =
    'rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'flex flex-col gap-2 text-left text-foreground'

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null
    return <span id={id} className="text-sm text-destructive">{message}</span>
}

function formatPriceInput(priceCents: number | null) {
    return priceCents === null ? '' : (priceCents / 100).toFixed(2)
}

export function EditListingForm({ listing }: { listing: EditableListingDetails }) {
    const router = useRouter()
    const [category, setCategory] = useState<ListingCategory>(listing.category)
    const [transactionTypes, setTransactionTypes] = useState<ListingTransactionType[]>(
        listing.transaction_types,
    )
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function toggleTransactionType(type: ListingTransactionType, checked: boolean) {
        setTransactionTypes((current) => (
            checked
                ? [...new Set([...current, type])]
                : current.filter((currentType) => currentType !== type)
        ))
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)

        setError(null)
        setFieldErrors({})

        startTransition(async () => {
            try {
                const result = await updateListingDetails(listing.id, formData)

                if (!result.success) {
                    setError(result.error.message)
                    setFieldErrors(result.fieldErrors ?? {})
                    return
                }

                router.replace('/profile?tab=listings')
                router.refresh()
            } catch {
                setError("We couldn't save your changes. Please try again.")
            }
        })
    }

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={isPending}
            className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"
        >
            <fieldset disabled={isPending} className="contents">
                {error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive"
                    >
                        {error}
                    </div>
                )}

                <div className="flex gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-left">
                    <Images className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                        <p className="font-medium text-foreground">Your photos will stay the same</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            This editor updates listing details only. Photo editing is not available yet.
                        </p>
                    </div>
                </div>

                <label className={labelClass}>
                    <span className="font-medium">Title *</span>
                    <input
                        type="text"
                        name="title"
                        maxLength={120}
                        required
                        defaultValue={listing.title}
                        aria-invalid={Boolean(fieldErrors.title)}
                        aria-describedby={fieldErrors.title ? 'edit-listing-title-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="edit-listing-title-error" message={fieldErrors.title} />
                </label>

                <label className={labelClass}>
                    <span className="font-medium">Description *</span>
                    <textarea
                        name="description"
                        maxLength={3000}
                        rows={5}
                        required
                        defaultValue={listing.description}
                        aria-invalid={Boolean(fieldErrors.description)}
                        aria-describedby={fieldErrors.description ? 'edit-listing-description-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="edit-listing-description-error" message={fieldErrors.description} />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                    <label className={labelClass}>
                        <span className="font-medium">Category *</span>
                        <select
                            name="category"
                            value={category}
                            onChange={(event) => setCategory(event.target.value as ListingCategory)}
                            required
                            aria-invalid={Boolean(fieldErrors.category)}
                            aria-describedby={fieldErrors.category ? 'edit-listing-category-error' : undefined}
                            className={inputClass}
                        >
                            {LISTING_CATEGORIES.map((option) => (
                                <option key={option} value={option}>
                                    {LISTING_CATEGORY_LABELS[option]}
                                </option>
                            ))}
                        </select>
                        <FieldError id="edit-listing-category-error" message={fieldErrors.category} />
                    </label>

                    <label className={labelClass}>
                        <span className="font-medium">Condition *</span>
                        <select
                            name="condition"
                            defaultValue={listing.condition}
                            required
                            aria-invalid={Boolean(fieldErrors.condition)}
                            aria-describedby={fieldErrors.condition ? 'edit-listing-condition-error' : undefined}
                            className={inputClass}
                        >
                            {LISTING_CONDITIONS.map((condition) => (
                                <option key={condition} value={condition}>
                                    {LISTING_CONDITION_LABELS[condition]}
                                </option>
                            ))}
                        </select>
                        <FieldError id="edit-listing-condition-error" message={fieldErrors.condition} />
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
                            defaultValue={listing.other_category ?? ''}
                            aria-invalid={Boolean(fieldErrors.other_category)}
                            aria-describedby={fieldErrors.other_category ? 'edit-listing-other-category-error' : undefined}
                            className={inputClass}
                        />
                        <FieldError
                            id="edit-listing-other-category-error"
                            message={fieldErrors.other_category}
                        />
                    </label>
                )}

                <fieldset
                    aria-describedby={fieldErrors.transaction_types ? 'edit-listing-transaction-types-error' : undefined}
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
                        id="edit-listing-transaction-types-error"
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
                                defaultValue={formatPriceInput(listing.price_cents)}
                                aria-invalid={Boolean(fieldErrors.price)}
                                aria-describedby={fieldErrors.price ? 'edit-listing-price-error' : undefined}
                                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-foreground outline-none"
                            />
                        </div>
                        <FieldError id="edit-listing-price-error" message={fieldErrors.price} />
                    </label>
                )}

                <label className={labelClass}>
                    <span className="font-medium">Pickup area *</span>
                    <input
                        type="text"
                        name="pickup_area"
                        maxLength={150}
                        required
                        defaultValue={listing.pickup_area}
                        aria-invalid={Boolean(fieldErrors.pickup_area)}
                        aria-describedby={fieldErrors.pickup_area ? 'edit-listing-pickup-area-error' : undefined}
                        className={inputClass}
                    />
                    <FieldError id="edit-listing-pickup-area-error" message={fieldErrors.pickup_area} />
                </label>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                        href="/profile?tab=listings"
                        className="rounded-xl border border-border px-5 py-3 text-center font-medium text-foreground transition hover:bg-secondary"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                        {isPending ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </fieldset>
        </form>
    )
}
