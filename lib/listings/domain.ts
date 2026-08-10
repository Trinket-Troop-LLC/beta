export const LISTING_CATEGORIES = [
    'true',
    'wearable',
    'home',
    'kitchen',
    'outdoorsy',
    'hobby',
    'other',
] as const

export type ListingCategory = (typeof LISTING_CATEGORIES)[number]

export const LISTING_CATEGORY_LABELS: Record<ListingCategory, string> = {
    true: 'true trinkets',
    wearable: 'wearable trinkets',
    home: 'home trinkets',
    kitchen: 'kitchen trinkets',
    outdoorsy: 'outdoorsy trinkets',
    hobby: 'hobby trinkets',
    other: 'other',
}

export const LISTING_CONDITIONS = [
    'new',
    'like_new',
    'good',
    'fair',
    'well_loved',
] as const

export type ListingCondition = (typeof LISTING_CONDITIONS)[number]

export const LISTING_CONDITION_LABELS: Record<ListingCondition, string> = {
    new: 'new',
    like_new: 'like new',
    good: 'good',
    fair: 'fair',
    well_loved: 'well loved',
}

export const LISTING_TRANSACTION_TYPES = ['sell', 'trade', 'gift'] as const

export type ListingTransactionType = (typeof LISTING_TRANSACTION_TYPES)[number]

export const LISTING_TRANSACTION_TYPE_LABELS: Record<ListingTransactionType, string> = {
    sell: 'sell',
    trade: 'trade',
    gift: 'gift',
}

export const LISTING_STATUSES = [
    'draft',
    'active',
    'reserved',
    'fulfilled',
    'archived',
] as const

export type ListingStatus = (typeof LISTING_STATUSES)[number]

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
    draft: 'draft',
    active: 'active',
    reserved: 'reserved',
    fulfilled: 'fulfilled',
    archived: 'archived',
}

export type Listing = {
    id: string
    owner_id: string
    title: string
    description: string
    category: ListingCategory
    other_category: string | null
    condition: ListingCondition
    transaction_types: ListingTransactionType[]
    price_cents: number | null
    pickup_area: string
    status: ListingStatus
    published_at: string | null
    created_at: string
    updated_at: string
}
