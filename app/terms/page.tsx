import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Terms of Service | Trinket Troop',
    robots: {
        index: false,
        follow: false,
    },
}

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background">
            <main className="mx-auto max-w-2xl px-4 py-12 text-foreground">
                <h1 className="text-2xl font-semibold text-foreground">Terms of Service</h1>

                <p className="mt-6 rounded-lg border border-dashed border-input bg-card p-4 text-sm text-muted-foreground">
                    Placeholder — this page is a stand-in so links from the beta application form resolve. Replace
                    this content with reviewed Terms of Service before launch.
                </p>

                <section className="mt-8 flex flex-col gap-4">
                    <h2 className="text-lg font-medium text-foreground">SMS Terms</h2>
                    <p>
                        By opting in to text messages from Trinket Troop, you agree to receive messages related to
                        your beta application, account, and occasional product updates. Message frequency varies.
                        Message and data rates may apply.
                    </p>
                    <p>Reply STOP at any time to opt out. Reply HELP for help.</p>
                </section>
            </main>
        </div>
    )
}
