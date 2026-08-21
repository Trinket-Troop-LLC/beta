import {
    CookingPot,
    Gem,
    House,
    PackageOpen,
    Palette,
    Sparkles,
    TreePine,
    type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ListingCategory } from '@/lib/listings/domain'

const categoryIcons: Record<ListingCategory, LucideIcon> = {
    true: Sparkles,
    wearable: Gem,
    home: House,
    kitchen: CookingPot,
    outdoorsy: TreePine,
    hobby: Palette,
    other: PackageOpen,
}

const fallbackIcons = Object.values(categoryIcons)

const palettes = [
    {
        background: 'from-[#f9e8d2] via-[#f2d3ad] to-[#dba66e]',
        foreground: 'text-[#6e3d22]',
        accent: 'bg-[#fff7e9]',
    },
    {
        background: 'from-[#e6eff0] via-[#c9dfe0] to-[#91b8b5]',
        foreground: 'text-[#285c59]',
        accent: 'bg-[#f5ffff]',
    },
    {
        background: 'from-[#eee8f5] via-[#d9cae9] to-[#aa8ec8]',
        foreground: 'text-[#594078]',
        accent: 'bg-[#fbf7ff]',
    },
    {
        background: 'from-[#f8e8e4] via-[#efcac3] to-[#d7958b]',
        foreground: 'text-[#733f39]',
        accent: 'bg-[#fff8f5]',
    },
    {
        background: 'from-[#eef0dc] via-[#d8ddb0] to-[#a9b66f]',
        foreground: 'text-[#4e5d2f]',
        accent: 'bg-[#fbfde9]',
    },
] as const

function hashListing(title: string, category?: string | null) {
    const value = `${category ?? ''}:${title.trim().toLowerCase()}`
    let hash = 0

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
    }

    return Math.abs(hash)
}

function getInitials(title: string) {
    const words = title.trim().split(/\s+/).filter(Boolean)

    if (words.length === 0) return 'TT'

    return words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join('')
}

function isListingCategory(category: string | null | undefined): category is ListingCategory {
    return Boolean(category && Object.prototype.hasOwnProperty.call(categoryIcons, category))
}

export function ListingPlaceholder({
    title,
    category,
    compact = false,
    className,
}: {
    title: string
    category?: string | null
    compact?: boolean
    className?: string
}) {
    const hash = hashListing(title, category)
    const palette = palettes[hash % palettes.length]
    const Icon = isListingCategory(category)
        ? categoryIcons[category]
        : fallbackIcons[hash % fallbackIcons.length]

    return (
        <div
            role="img"
            aria-label={`Illustrated placeholder for ${title}`}
            className={cn(
                'relative isolate flex size-full items-center justify-center overflow-hidden bg-gradient-to-br',
                palette.background,
                palette.foreground,
                className,
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'absolute -left-[14%] -top-[12%] size-[62%] rounded-full opacity-45',
                    palette.accent,
                )}
            />
            <span
                aria-hidden="true"
                className={cn(
                    'absolute -bottom-[22%] -right-[16%] size-[72%] rounded-full opacity-35',
                    palette.accent,
                )}
            />
            <span
                aria-hidden="true"
                className={cn(
                    'relative flex size-[48%] max-h-32 max-w-32 items-center justify-center rounded-full shadow-sm ring-1 ring-current/10',
                    palette.accent,
                )}
            >
                <Icon className="size-[54%]" strokeWidth={1.6} />
            </span>
            {!compact && (
                <span
                    aria-hidden="true"
                    className="absolute bottom-[7%] right-[7%] rounded-full bg-white/65 px-2 py-1 text-[clamp(0.6rem,2.5vw,0.8rem)] font-semibold tracking-[0.08em] shadow-sm backdrop-blur-sm"
                >
                    {getInitials(title)}
                </span>
            )}
        </div>
    )
}
