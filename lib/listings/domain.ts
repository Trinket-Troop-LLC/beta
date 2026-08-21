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

export const LISTING_TRANSACTION_TYPES = ['sell', 'trade', 'gift', 'lend'] as const

export type ListingTransactionType = (typeof LISTING_TRANSACTION_TYPES)[number]

export const LISTING_TRANSACTION_TYPE_LABELS: Record<ListingTransactionType, string> = {
    sell: 'sell',
    trade: 'trade',
    gift: 'gift',
    lend: 'lend',
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

export function formatListingPrice(priceCents: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(priceCents / 100)
}

export type Listing = {
    id: string
    owner_id: string
    title: string
    description: string
    ideal_trade_description: string | null
    category: ListingCategory
    other_category: string | null
    condition: ListingCondition
    transaction_types: ListingTransactionType[]
    price_cents: number | null
    pickup_area: string
    status: ListingStatus
    // Which selected transaction type the current reservation actually is
    // (a listing can offer several at once, e.g. sell + trade + lend, but
    // only one is ever in play while reserved). Null except while reserved.
    active_transaction_type: ListingTransactionType | null
    published_at: string | null
    created_at: string
    updated_at: string
}
