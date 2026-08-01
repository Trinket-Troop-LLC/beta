import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'General Interest | Trinket Troop',
    description:
        'Join the Trinket Troop waiting list for a friendlier way to buy, sell, trade, and gift secondhand treasures in New York City.',
    openGraph: {
        title: 'Trinket Troop — General Interest',
        description: 'Join the waiting list for a friendlier way to exchange secondhand treasures in New York City.',
    },
    twitter: {
        title: 'Trinket Troop — General Interest',
        description: 'Join the waiting list for a friendlier way to exchange secondhand treasures in New York City.',
    },
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
    return children
}
