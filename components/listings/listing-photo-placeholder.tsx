import {
    Gem,
    Home,
    PackageOpen,
    Palette,
    Shirt,
    TreePine,
    Utensils,
    type LucideIcon,
} from 'lucide-react'
import {
    LISTING_CATEGORY_LABELS,
    type ListingCategory,
} from '@/lib/listings/domain'

const CATEGORY_ICONS: Record<ListingCategory, LucideIcon> = {
    true: Gem,
    wearable: Shirt,
    home: Home,
    kitchen: Utensils,
    outdoorsy: TreePine,
    hobby: Palette,
    other: PackageOpen,
}

export function ListingPhotoPlaceholder({
    category,
    title,
    className = '',
}: {
    category: ListingCategory
    title: string
    className?: string
}) {
    const Icon = CATEGORY_ICONS[category]

    return (
        <div
            role="img"
            aria-label={`Placeholder artwork for ${title}`}
            className={`flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-secondary via-background to-accent px-5 text-center text-primary ${className}`}
        >
            <span className="flex size-16 items-center justify-center rounded-full border border-primary/15 bg-card/80 shadow-sm">
                <Icon className="size-8" aria-hidden="true" />
            </span>
            <span className="max-w-full text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {LISTING_CATEGORY_LABELS[category]}
            </span>
        </div>
    )
}
