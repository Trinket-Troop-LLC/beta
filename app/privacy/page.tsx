import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Privacy Policy | Trinket Troop',
    robots: {
        index: false,
        follow: false,
    },
}

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background">
            <main className="mx-auto max-w-2xl px-4 py-12 text-foreground">
                <h1 className="text-2xl font-semibold text-foreground">Privacy Policy</h1>

                <p className="mt-6 rounded-lg border border-dashed border-input bg-card p-4 text-sm text-muted-foreground">
                    Placeholder — this page is a stand-in so links from the beta application form resolve. Replace
                    this content with a reviewed Privacy Policy before launch.
                </p>

                <section className="mt-8 flex flex-col gap-4">
                    <h2 className="text-lg font-medium text-foreground">Text messaging data</h2>
                    <p>
                        Phone numbers collected for text message opt-in are used only to send the messages described
                        at the point of collection. We do not sell or share mobile opt-in data with third parties for
                        marketing purposes.
                    </p>
                </section>
            </main>
        </div>
    )
}
