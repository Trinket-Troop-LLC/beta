import Image from 'next/image'
import Link from 'next/link'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export default function WelcomePage() {
    return (
        <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-background font-inter">
            <MissionLogoHeader />

            {/* One structure for every viewport: every element is positioned as a percentage of
                this container, so they share one consistent grid instead of each carrying its
                own guessed offset. Sizing scales off --canvas-text (shared with why-us/about/
                mission so all four pages sit on the same type scale), so the composition scales
                continuously from phone to desktop instead of swapping layouts. */}
            <div
                className="relative flex-1"
                style={{ fontSize: 'var(--canvas-text)' }}
            >
                {/* bag.png / vase.png are already-rotated Figma exports — their own pixel
                    dimensions are the post-rotation bounding box (243×265, 136×238), so they're
                    placed top-left-anchored at that bounding box's Figma position with no extra
                    CSS rotation; adding one would double-rotate them. */}
                <Image
                    src="/mission/bag.png"
                    alt=""
                    width={243}
                    height={265}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[-32.34%] top-[34.21%] w-[17.5em] lg:left-[-12.97%] lg:top-[35.11%] lg:w-[19em]"
                />

                <Image
                    src="/mission/vase.png"
                    alt=""
                    width={136}
                    height={238}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[87.03%] top-[55.95%] w-[9.7em] opacity-90 lg:left-[92.5%] lg:top-[42.43%] lg:w-[10em]"
                />

                {/* Title, body copy, button, and the venn block are one centered column —
                    mx-auto against inset-x-0 centers it on the page regardless of viewport, with
                    a shared max-width and gap rhythm reused across home/why-us/about so all three
                    read the same way instead of each carrying its own left%/gap guesses. Title-to
                    -body uses a tighter inner gap than the rest of the stack. */}
                <div className="absolute inset-x-0 top-[22.08%] mx-auto flex max-w-[40ch] flex-col items-start gap-[0.85em] lg:top-[1.5%] lg:max-w-[54ch]">
                    <div className="flex flex-col gap-[0.6em]">
                        <h1 className="max-w-[22ch] text-balance font-sophie-chalk text-[1.85em] leading-[1.2] text-foreground">
                            Reimagining peer-to-peer exchange in New York City&hellip;
                        </h1>

                        <p className="text-[1em] leading-[1.65] text-[#2c2c2c]">
                            &hellip;for city dwellers drowning in their piles of things, for home-based artists and
                            second-hand curators, for upcyclers searching for their next project, for students moving
                            into their first apartment, for adamant downsizers and frugal upsizers, for sweetiepies
                            who want to get to know their neighborhood&hellip;
                        </p>
                    </div>

                    {/* Not part of the source design (which has no CTA at all) — kept per request. */}
                    <Link
                        href="/apply"
                        className="inline-block rounded-lg bg-[#7c9272] px-[1.5em] py-[0.75em] text-[1em] font-medium text-white transition hover:bg-[#667b5f]"
                    >
                        Join the waiting list
                    </Link>

                    {/* One cluster, positioned as percentages of its own box — mirrors the
                        source design, where "trinket troop", the arrow, and the two ellipse
                        labels are all one connected illustration rather than separate
                        elements stacked in flow. */}
                    <div className="relative aspect-[254/287] w-[11.5em] sm:w-[13.5em] lg:w-[14em]">
                        <div className="absolute left-0 top-[41.83%] h-[58.19%] w-full">
                            <Image src="/mission/venn.png" alt="" fill className="object-contain" aria-hidden="true" />
                        </div>

                        <Link
                            href="/why-us"
                            className="absolute left-[26.29%] top-[13%] w-[29.02%] -rotate-[11deg] font-sophie-chalk text-[0.75em] leading-tight text-foreground underline decoration-foreground/60 underline-offset-4 transition hover:text-primary"
                        >
                            trinket troop
                        </Link>

                        <Image
                            src="/mission/arrow.svg"
                            alt=""
                            width={82}
                            height={14}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-[49.54%] top-[46.14%] w-[32.3%] -translate-x-1/2 -translate-y-1/2 rotate-[87deg]"
                        />

                        <span className="absolute left-[7%] top-[59.41%] w-[36%] -rotate-[2deg] font-sophie-chalk text-[0.7em] font-medium text-[#4a2e22]">
                            solving
                            <br />
                            logistical challenges
                        </span>
                        <span className="absolute left-[55%] top-[56.11%] w-[44%] -rotate-[22deg] font-sophie-chalk text-[0.7em] font-medium text-[#4a3a1c]">
                            building stronger community
                        </span>
                    </div>
                </div>

                <p className="absolute left-[64.53%] top-[88.67%] font-sophie-chalk text-[0.8em] text-muted-foreground lg:left-[61.52%] lg:top-[79.81%]">
                    by{' '}
                    <Link
                        href="/about"
                        className="underline decoration-muted-foreground/60 underline-offset-4 transition hover:text-foreground"
                    >
                        caro &amp; martina
                    </Link>
                    <br />
                    xoxo
                </p>
            </div>
        </main>
    )
}
