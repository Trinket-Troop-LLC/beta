import Image from 'next/image'
import type { Metadata } from 'next'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export const metadata: Metadata = {
    title: 'Why Trinket Troop | Trinket Troop',
    description: 'Why trinket troop exists, and how it works.',
}

export default function WhyUsPage() {
    return (
        <main
            className="relative flex min-h-screen flex-col overflow-x-hidden bg-background font-inter"
            style={{ fontSize: 'var(--canvas-text)' }}
        >
            <MissionLogoHeader />

            {/* Sizing scales off --canvas-text, shared with home/about/mission so all four pages
                sit on the same type scale — set on <main> so the shared header inherits it too.
                boot.png flanks the text column the same way home's vase does — an already-
                rotated export, top-left anchored. */}
            <div className="relative flex-1">
                <Image
                    src="/mission/boot.png"
                    alt=""
                    width={253}
                    height={333}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[85%] top-[55%] w-[13em] lg:left-[90%] lg:top-[38%] lg:w-[11em]"
                />

                {/* Same centered-column pattern as home: inset-x-0 + mx-auto centers it on the
                    page, with the same max-width and title-to-body gap so all three pages read
                    the same way. */}
                <div className="absolute inset-x-0 top-[10.3%] mx-auto flex max-w-[40ch] flex-col gap-[0.6em] lg:top-[10.82%] lg:max-w-[54ch]">
                    <h1 className="text-balance font-sophie-chalk text-[length:var(--text-heading)] text-foreground">
                        Why trinket troop?
                    </h1>

                    <div className="flex flex-col gap-[var(--gap-base)] text-[length:var(--text-body)] leading-[1.4] text-foreground">
                        <p>
                            New York City is filled to the brim with interesting things and even more interesting
                            people. So why is the peer-to-peer exchange landscape so bleak? Transactions that flake,
                            messages without intention, assistive services monopolized&hellip; the overwhelming
                            logistics and time-suck is enough to make even the most well-intentioned thrifter turn to
                            the convenience offered by billion-dollar corporations.
                        </p>

                        <p>
                            At trinket troop, we believe a better way is possible (and right in front of us!). By
                            creating a framework that utilizes social bonds &mdash;prospective and existing&mdash; to
                            facilitate successful exchanges, everyone wins.
                        </p>

                        <p>
                            Other peer-to-peer marketplaces focus on the transaction in a vacuum, with some
                            consideration for physical proximity; we know this alone isn&apos;t enough. It is much
                            easier to coordinate exchanges within established social contracts of mutualism,
                            accountability, and care.
                        </p>

                        <p>
                            Incorporating the procurement and re-homing of items into the interpersonal fabric of our
                            lives &mdash;instead of keeping them separate&mdash; creates symbiotic processes that feel
                            both fulfilling AND convenient.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}
