import type { Metadata } from 'next'
import { BetaApplicationForm } from './beta-application-form'

export const metadata: Metadata = {
    title: 'Beta Access | Trinket Troop',
    description: 'Apply to help shape the first Trinket Troop beta community.',
    openGraph: {
        title: 'Trinket Troop — Beta Access',
        description: 'Apply to help shape the first Trinket Troop beta community.',
    },
    twitter: {
        title: 'Trinket Troop — Beta Access',
        description: 'Apply to help shape the first Trinket Troop beta community.',
    },
    robots: {
        index: false,
        follow: false,
    },
}

export default function BetaApplicationPage() {
    return <BetaApplicationForm />
}
