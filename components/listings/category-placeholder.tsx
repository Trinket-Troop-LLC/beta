import { Gem, Shirt, House, UtensilsCrossed, Trees, Palette, Package } from 'lucide-react'
import type { ListingCategory } from '@/lib/listings/domain'

const CATEGORY_ICONS: Record<ListingCategory, typeof Gem> = {
    true: Gem,
    wearable: Shirt,
    home: House,
    kitchen: UtensilsCrossed,
    outdoorsy: Trees,
    hobby: Palette,
    other: Package,
}

// Shown in place of a cover photo -- photos are optional, so a listing with
// none still needs some visual distinction between categories in a grid of
// cards, not just a repeated generic icon.
export function CategoryPlaceholder({ category, iconClassName }: { category: ListingCategory; iconClassName?: string }) {
    const Icon = CATEGORY_ICONS[category] ?? Package

    return (
        <div className="flex size-full items-center justify-center text-muted-foreground">
            <Icon className={iconClassName ?? 'size-9'} />
        </div>
    )
}
