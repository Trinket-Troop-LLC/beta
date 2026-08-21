import Image from 'next/image'
import Link from 'next/link'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export default function WelcomePage() {
    return (
        <main
            className="relative flex min-h-screen flex-col overflow-x-hidden bg-background font-inter"
            style={{ fontSize: 'var(--canvas-text)' }}
        >
            <MissionLogoHeader />

            {/* One structure for every viewport: every element is positioned as a percentage of
                this container, so they share one consistent grid instead of each carrying its
                own guessed offset. Sizing scales off --canvas-text (shared with why-us/about/
                mission so all four pages sit on the same type scale — set on <main> so the
                shared header inherits it too), so the composition scales continuously from
                phone to desktop instead of swapping layouts. */}
            <div className="relative flex-1">
                {/* vase.png is an already-rotated Figma export — its own pixel dimensions are
                    the post-rotation bounding box (136×238), so it's placed top-left-anchored at
                    that bounding box's Figma position with no extra CSS rotation; adding one
                    would double-rotate it. */}
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
                    <div className="flex flex-col gap-[var(--gap-tight)]">
                        <h1 className="text-balance font-sophie-chalk text-[length:var(--text-heading)] leading-[1.2] text-foreground">
                            Reimagining peer-to-peer exchange in New York City
                        </h1>

                        <p className="text-balance text-[length:var(--text-body)] leading-[1.65] text-foreground">
                            &hellip;for city dwellers drowning in their piles of things, for home-based artists and
                            second-hand curators, for upcyclers searching for their next project, for students moving
                            into their first apartment, for adamant downsizers and frugal upsizers, for sweetiepies
                            who want to get to know their neighborhood&hellip;
                        </p>
                    </div>

                    {/* Not part of the source design (which has no CTA at all) — kept per request. */}
                    <Link
                        href="/apply"
                        className="inline-block rounded-lg bg-primary px-[1.5em] py-[0.75em] text-[length:var(--text-body)] font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        Join the waiting list
                    </Link>

                    {/* One cluster, positioned as percentages of its own box — mirrors the
                        source design, where "trinket troop", the arrow, and the two ellipse
                        labels are all one connected illustration rather than separate
                        elements stacked in flow.

                        The CSS vars below are named reference points measured directly from
                        venn.png's pixel data (sampling fill color to find where pink-only,
                        overlap, and yellow-only regions start/end — see git history for the
                        derivation), not guessed. Point a future tweak at one of these names
                        ("shift right of --pink-label-x") instead of re-deriving a fresh
                        percentage from scratch. */}
                    <div
                        className="relative aspect-[254/287] w-[11.5em] sm:w-[13.5em] lg:w-[14em]"
                        style={{
                            '--overlap-x': '49.54%',
                            '--pink-label-x': '14%',
                            '--pink-label-y': '64%',
                            '--yellow-label-x': '65%',
                            '--yellow-label-y': '58%',
                        } as React.CSSProperties}
                    >
                        <div className="absolute left-0 top-[41.83%] h-[58.19%] w-full">
                            <Image src="/mission/venn.png" alt="" fill className="object-contain" aria-hidden="true" />
                        </div>

                        <Link
                            href="/why-us"
                            className="absolute left-[var(--overlap-x)] top-[34%] w-[29.02%] -translate-x-1/2 -rotate-[11deg] font-sophie-chalk text-[0.75em] leading-tight text-foreground underline decoration-foreground/60 underline-offset-4 transition hover:text-primary"
                        >
                            trinket troop
                        </Link>

                        <Image
                            src="/mission/arrow.svg"
                            alt=""
                            width={82}
                            height={14}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-[var(--overlap-x)] top-[60%] w-[32.3%] -translate-x-1/2 -translate-y-1/2 rotate-[87deg]"
                        />

                        <span className="absolute left-[var(--pink-label-x)] top-[var(--pink-label-y)] w-[24%] -rotate-[2deg] font-sophie-chalk text-[0.65em] font-medium text-[#4a2e22]">
                            solving
                            <br />
                            logistical challenges
                        </span>
                        <span className="absolute left-[var(--yellow-label-x)] top-[var(--yellow-label-y)] w-[25%] -rotate-[6deg] font-sophie-chalk text-[0.65em] font-medium text-[#4a3a1c]">
                            building stronger community
                        </span>
                    </div>
                </div>

                <p className="absolute left-[64.53%] top-[88.67%] font-sophie-chalk text-[length:var(--text-caption)] text-muted-foreground lg:left-[61.52%] lg:top-[79.81%]">
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
