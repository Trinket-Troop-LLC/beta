import { z } from 'zod'
import {
    LISTING_CATEGORIES,
    LISTING_CONDITIONS,
    LISTING_TRANSACTION_TYPES,
} from '@/lib/listings/domain'

// Shared between posts/actions.ts (create) and posts/edit-actions.ts (edit) --
// kept in a plain module (no 'use server') since Next.js requires every
// export of a 'use server' file to itself be an async Server Action, and
// these are synchronous helpers used by several server actions in both files.

export type FieldErrors = Record<string, string>

const maxPostgresInteger = 2_147_483_647

export function parsePriceCents(value: string): number | null {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())

    if (!match) {
        return null
    }

    const dollars = Number(match[1])
    const cents = Number((match[2] ?? '').padEnd(2, '0'))
    const total = dollars * 100 + cents

    return Number.isSafeInteger(total) ? total : null
}

export const listingDraftSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(1, 'Enter a title.')
            .max(120, 'Keep the title to 120 characters or fewer.'),
        description: z
            .string()
            .trim()
            .min(1, 'Enter a description.')
            .max(3000, 'Keep the description to 3,000 characters or fewer.'),
        nuance: z
            .string()
            .trim()
            .max(500, 'Keep the nuance note to 500 characters or fewer.'),
        category: z.enum(LISTING_CATEGORIES, {
            error: 'Choose a category from the list.',
        }),
        other_category: z
            .string()
            .trim()
            .max(100, 'Keep the category description to 100 characters or fewer.'),
        condition: z.enum(LISTING_CONDITIONS, {
            error: 'Choose the item condition from the list.',
        }),
        transaction_types: z
            .array(z.enum(LISTING_TRANSACTION_TYPES, {
                error: 'Choose only sell, trade, gift, or lend.',
            }))
            .min(1, 'Choose whether you want to sell, trade, gift, or lend this item.')
            .max(4, 'Choose no more than sell, trade, gift, and lend.')
            .transform((types) => [...new Set(types)]),
        price: z.string().trim().max(20, 'The price is too long.'),
        pickup_area: z
            .string()
            .trim()
            .min(1, 'Enter a neighborhood or general pickup area.')
            .max(150, 'Keep the pickup area to 150 characters or fewer.'),
    })
    .superRefine((listing, context) => {
        if (listing.category === 'other' && !listing.other_category) {
            context.addIssue({
                code: 'custom',
                message: 'Describe the item category.',
                path: ['other_category'],
            })
        }

        const isForSale = listing.transaction_types.includes('sell')
        const priceCents = parsePriceCents(listing.price)

        if (isForSale) {
            if (!listing.price) {
                context.addIssue({
                    code: 'custom',
                    message: 'Enter a price when selling an item.',
                    path: ['price'],
                })
            } else if (priceCents === null) {
                context.addIssue({
                    code: 'custom',
                    message: 'Enter the price with up to two decimal places, such as 25.00.',
                    path: ['price'],
                })
            } else if (priceCents <= 0) {
                context.addIssue({
                    code: 'custom',
                    message: 'The sale price must be greater than $0.',
                    path: ['price'],
                })
            } else if (priceCents > maxPostgresInteger) {
                context.addIssue({
                    code: 'custom',
                    message: 'The price cannot exceed $21,474,836.47.',
                    path: ['price'],
                })
            }
        } else if (listing.price) {
            context.addIssue({
                code: 'custom',
                message: 'Remove the price or choose sell.',
                path: ['price'],
            })
        }
    })

export function getText(formData: FormData, name: string) {
    const value = formData.get(name)
    return typeof value === 'string' ? value : ''
}

export function buildFieldErrors(error: z.ZodError): FieldErrors {
    const fieldErrors: FieldErrors = {}

    for (const issue of error.issues) {
        const field = issue.path[0]?.toString()
        if (field && !fieldErrors[field]) {
            fieldErrors[field] = issue.message
        }
    }

    return fieldErrors
}

type ConstraintError = { code?: string; message?: string }

export function getListingConstraintFailure(error: ConstraintError) {
    if (error.code !== '23514') {
        return null
    }

    const message = error.message?.toLowerCase() ?? ''
    const constraints: Array<{ pattern: string; field: string; message: string }> = [
        {
            pattern: 'listings_title_check',
            field: 'title',
            message: 'Enter a visible title of 120 characters or fewer.',
        },
        {
            pattern: 'listings_description_check',
            field: 'description',
            message: 'Enter a visible description of 3,000 characters or fewer.',
        },
        {
            pattern: 'listings_nuance_check',
            field: 'nuance',
            message: 'Keep the nuance note to 500 characters or fewer.',
        },
        {
            pattern: 'listings_category_check',
            field: 'category',
            message: 'Choose a category from the list.',
        },
        {
            pattern: 'listings_other_category_check',
            field: 'other_category',
            message: 'Describe the other category in 100 characters or fewer.',
        },
        {
            pattern: 'listings_condition_check',
            field: 'condition',
            message: 'Choose the item condition from the list.',
        },
        {
            pattern: 'listings_transaction_types_check',
            field: 'transaction_types',
            message: 'Choose one or more of sell, trade, gift, or lend without duplicates.',
        },
        {
            pattern: 'listings_price_check',
            field: 'price',
            message: 'A sale needs a price greater than $0; non-sale listings cannot include a price.',
        },
        {
            pattern: 'listings_pickup_area_check',
            field: 'pickup_area',
            message: 'Enter a visible pickup area of 150 characters or fewer.',
        },
    ]

    return constraints.find((constraint) => message.includes(constraint.pattern)) ?? {
        field: 'form',
        message: 'One or more listing details did not meet the posting rules.',
    }
}
