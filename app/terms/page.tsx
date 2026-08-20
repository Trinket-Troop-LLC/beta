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
        <div className="min-h-screen bg-[#faf7f0]">
            <main className="mx-auto max-w-2xl px-4 py-12 text-[#2c2c2c]">
                <h1 className="text-2xl font-semibold text-[#30392d]">Terms of Service</h1>

                <p className="mt-6 rounded-lg border border-dashed border-[#d8d1c5] bg-[#fffdf9] p-4 text-sm text-[#7c8072]">
                    Placeholder — this page is a stand-in so links from the beta application form resolve. Replace
                    this content with reviewed Terms of Service before launch.
                </p>

                <section className="mt-8 flex flex-col gap-4">
                    <h2 className="text-lg font-medium text-[#30392d]">SMS Terms</h2>
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
