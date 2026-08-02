import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { BetaApplicationForm } from './beta-application-form'

export const metadata: Metadata = {
    title: 'Beta Access | Trinket Troop',
    description: 'Apply to help shape the first Trinket Troop beta community.',
    openGraph: {
        title: 'Trinket Troop — Beta Access',
        description: 'Apply to help shape the first Trinket Troop beta community.',
        images: ['/opengraph-image.png'],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Trinket Troop — Beta Access',
        description: 'Apply to help shape the first Trinket Troop beta community.',
        images: ['/twitter-image.png'],
    },
    robots: {
        index: false,
        follow: false,
    },
}

export default function BetaApplicationPage() {
    return (
        <>
            <SiteHeader />
            <BetaApplicationForm />
        </>
    )
}
