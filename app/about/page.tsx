import Image from 'next/image'
import type { Metadata } from 'next'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export const metadata: Metadata = {
    title: 'About Us | Trinket Troop',
    description: 'Who we are.',
}

export default function AboutPage() {
    return (
        <main
            className="relative flex min-h-screen flex-col overflow-x-hidden bg-background font-inter"
            style={{ fontSize: 'var(--canvas-text)' }}
        >
            <MissionLogoHeader />

            {/* Positions below the lg: (desktop) breakpoint come from a fresh Figma read;
                the base (phone) values are extrapolated from that same delta since the Figma
                MCP quota ran out mid-session — proportionally shifted, not independently
                verified. Re-check against the phone frame once quota resets. wagon-sketch.png
                is the flattened, pre-rotated export (top-left anchored, no CSS rotation needed).
                Sizing scales off --canvas-text, shared with home/why-us/mission so all four pages
                sit on the same type scale — set on <main> so the shared header inherits it too. */}
            <div className="relative flex-1">
                <Image
                    src="/mission/wagon-sketch.png"
                    alt=""
                    width={713}
                    height={713}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[-64.97%] top-[22.37%] w-[50.92em] lg:left-[12.7%] lg:top-[16.83%] lg:w-[35.64em]"
                />

                {/* Same centered-column pattern as home/why-us: inset-x-0 + mx-auto centers it
                    on the page, with the same max-width and title-to-body gap so all three pages
                    read the same way — the old max-w-[26ch]/12.24em here was much narrower than
                    the other two pages for no real reason. */}
                <div className="absolute inset-x-0 top-[16.78%] mx-auto flex max-w-[40ch] flex-col gap-[0.6em] lg:top-[18.63%] lg:max-w-[54ch]">
                    <h1 className="font-sophie-chalk text-[length:var(--text-heading)] text-foreground">Who we are..</h1>

                    <p className="text-[length:var(--text-body)] text-foreground">
                        Caroline Shimeall and Martina Gai, a urban studies and software engineering duo dreaming of a
                        better way to connect people to the things they need, and in the process, each other
                    </p>
                </div>

                <p className="absolute left-[56.72%] top-[87.5%] font-sophie-chalk text-[length:var(--text-caption)] text-muted-foreground">
                    under construction&hellip;
                </p>
            </div>
        </main>
    )
}
