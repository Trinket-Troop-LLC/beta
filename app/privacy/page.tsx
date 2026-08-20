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
        <div className="min-h-screen bg-[#faf7f0]">
            <main className="mx-auto max-w-2xl px-4 py-12 text-[#2c2c2c]">
                <h1 className="text-2xl font-semibold text-[#30392d]">Privacy Policy</h1>

                <p className="mt-6 rounded-lg border border-dashed border-[#d8d1c5] bg-[#fffdf9] p-4 text-sm text-[#7c8072]">
                    Placeholder — this page is a stand-in so links from the beta application form resolve. Replace
                    this content with a reviewed Privacy Policy before launch.
                </p>

                <section className="mt-8 flex flex-col gap-4">
                    <h2 className="text-lg font-medium text-[#30392d]">Text messaging data</h2>
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
