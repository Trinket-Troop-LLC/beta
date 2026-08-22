'use client'

import Image from 'next/image'
import { useState } from 'react'
import { CategoryPlaceholder } from './category-placeholder'
import type { ListingCategory } from '@/lib/listings/domain'

export function PhotoCarousel({
    photoUrls,
    title,
    category,
}: {
    photoUrls: string[]
    title: string
    category: ListingCategory
}) {
    const [activeIndex, setActiveIndex] = useState(0)

    if (photoUrls.length === 0) {
        return (
            <div className="aspect-square w-full rounded-2xl bg-secondary">
                <CategoryPlaceholder category={category} iconClassName="size-12" />
            </div>
        )
    }

    return (
        <div>
            <div
                onScroll={(event) => {
                    const target = event.currentTarget
                    const index = Math.round(target.scrollLeft / target.clientWidth)
                    setActiveIndex(index)
                }}
                className="flex gap-2 overflow-x-auto rounded-2xl snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {photoUrls.map((url, index) => (
                    <div
                        key={url}
                        className="relative aspect-square w-full flex-none snap-center overflow-hidden rounded-2xl bg-secondary"
                    >
                        <Image
                            src={url}
                            alt={`${title} photo ${index + 1}`}
                            fill
                            sizes="(max-width: 640px) 100vw, 640px"
                            className="object-cover"
                            priority={index === 0}
                        />
                    </div>
                ))}
            </div>

            {photoUrls.length > 1 && (
                <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
                    {photoUrls.map((url, index) => (
                        <span
                            key={url}
                            className={`size-1.5 rounded-full transition-colors ${
                                index === activeIndex ? 'bg-primary' : 'bg-muted'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
