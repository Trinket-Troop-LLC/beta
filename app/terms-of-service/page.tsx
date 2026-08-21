import type { Metadata } from 'next'
import Link from 'next/link'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export const metadata: Metadata = {
    title: 'Terms of Service | Trinket Troop',
    description: 'The terms that govern your use of the Trinket Troop app and Site.',
}

const sectionClass = 'flex flex-col gap-3'
const headingClass = 'text-xl font-semibold text-[#30392d]'
const bodyClass = 'text-[#625f58]'
const listClass = 'flex flex-col gap-2 pl-5 text-[#625f58]'
const linkClass = 'text-[#7c9272] underline hover:text-[#5f7258]'

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <MissionLogoHeader />

            <main className="mx-auto max-w-3xl px-4 py-12">
                <article className="flex flex-col gap-8 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm sm:p-10">
                    <header className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold text-[#30392d] sm:text-3xl">
                            Trinket Troop Terms of Service
                        </h1>
                        <p className="text-sm text-[#7c8072]">Last updated: August 20, 2026</p>
                    </header>

                    <div className={sectionClass}>
                        <p className={bodyClass}>
                            Welcome to Trinket Troop. These Terms of Service (&quot;Terms&quot;) govern your use of the
                            Trinket Troop app and Site at https://www.trinkettroop.com/ (the &quot;Services&quot;),
                            operated by Trinket Troop LLC (&quot;Trinket Troop,&quot; &quot;we,&quot; &quot;us&quot;).
                            By creating an account or otherwise using the Services, you agree to these Terms. If you
                            don&apos;t agree, please don&apos;t use the Services.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>1. Eligibility</h2>
                        <p className={bodyClass}>
                            You must be at least 18 years old and able to form a binding contract to use the Services.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>2. The Service</h2>
                        <p className={bodyClass}>
                            Trinket Troop is a community platform that connects New Yorkers to barter, trade, gift,
                            and skill-share second-hand items with one another. The Services are currently in beta
                            &mdash; features, availability, and functionality may change or be discontinued at any
                            time, and the Services are provided on an &quot;as is&quot; and &quot;as available&quot;
                            basis during this period.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>3. Your Account</h2>
                        <p className={bodyClass}>
                            You&apos;re responsible for keeping your account credentials and phone number current, and
                            for all activity that happens under your account. If you suspect unauthorized use, contact
                            us right away at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>
                            .
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>4. Community Conduct</h2>
                        <p className={bodyClass}>
                            Trinket Troop runs on trust, mutualism, and care for the community. When using the
                            Services, you agree not to:
                        </p>
                        <ul className={`list-disc ${listClass}`}>
                            <li>Post false, misleading, counterfeit, stolen, or illegal listings</li>
                            <li>Harass, threaten, discriminate against, or defraud other members</li>
                            <li>Attempt to circumvent the platform&apos;s safety features or contact members outside the app to bypass them</li>
                        </ul>
                        <p className={bodyClass}>
                            We may suspend or remove any account that violates these Terms or puts other members at
                            risk, at our discretion.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>5. Trades &amp; In-Person Exchanges</h2>
                        <p className={bodyClass}>
                            Trinket Troop facilitates connections between members but is not a party to any trade you
                            make. We don&apos;t inspect, authenticate, or guarantee the condition, safety, legality,
                            value, or accuracy of any item or skill listed or exchanged through the Services. You are
                            solely responsible for evaluating any trade you enter into and for your own safety during
                            any in-person meetup &mdash; we recommend meeting in public places, telling someone where
                            you&apos;re going, and trusting your judgment.
                        </p>
                        <p className={bodyClass}>
                            Any dispute that arises between members over a trade is between those members. Trinket
                            Troop is not responsible for resolving disputes, but you can report concerning behavior to
                            us at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>{' '}
                            to help keep the community safe.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>6. Listings &amp; User Content</h2>
                        <p className={bodyClass}>
                            You retain ownership of the listings, photos, descriptions, and messages you post
                            (&quot;User Content&quot;), but you grant Trinket Troop a license to display, distribute,
                            and use that content within the Services to operate the platform. You&apos;re responsible
                            for making sure you have the right to post whatever you submit, and that it doesn&apos;t
                            infringe on anyone else&apos;s rights.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>7. Text Messaging (SMS/RCS)</h2>
                        <p className={bodyClass}>
                            If you provide your phone number, we&apos;ll send you account and trade-related text
                            messages via our provider, Twilio, as described in our separate{' '}
                            <Link href="/sms-terms" className={linkClass}>
                                SMS Terms of Service
                            </Link>
                            .
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>8. Disclaimers</h2>
                        <p className={bodyClass}>
                            THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT
                            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
                            PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE FULLEST EXTENT PERMITTED BY LAW. WE DO
                            NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY
                            TRADE ARRANGED THROUGH THE SERVICES WILL MEET YOUR EXPECTATIONS.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>9. Limitation of Liability</h2>
                        <p className={bodyClass}>
                            TO THE FULLEST EXTENT PERMITTED BY LAW, TRINKET TROOP LLC WILL NOT BE LIABLE FOR ANY
                            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF
                            THE SERVICES OR ANY TRADE, GIFT, OR IN-PERSON MEETUP CONDUCTED THROUGH THEM, INCLUDING
                            DAMAGES RELATED TO THE CONDITION OF EXCHANGED ITEMS OR YOUR PERSONAL SAFETY DURING A
                            MEETUP.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>10. Indemnification</h2>
                        <p className={bodyClass}>
                            You agree to indemnify and hold Trinket Troop LLC harmless from any claims, losses, or
                            damages arising out of your use of the Services, your User Content, your trades with
                            other members, or your violation of these Terms.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>11. Termination</h2>
                        <p className={bodyClass}>
                            We may suspend or terminate your access to the Services at any time, with or without
                            cause. You may stop using the Services and delete your account at any time by contacting
                            us at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>
                            .
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>12. Governing Law</h2>
                        <p className={bodyClass}>
                            These Terms are governed by the laws of the State of New York, without regard to its
                            conflict-of-law principles.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>13. Changes to These Terms</h2>
                        <p className={bodyClass}>
                            We may update these Terms from time to time. We&apos;ll post the revised Terms on the Site
                            and update the &quot;Last updated&quot; date. Continuing to use the Services after changes
                            take effect means you accept the updated Terms.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>14. Contact Us</h2>
                        <p className={bodyClass}>
                            Questions about these Terms? Reach us at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>
                            . For details on how we handle your personal information, see our{' '}
                            <Link href="/privacy-policy" className={linkClass}>
                                Privacy Policy
                            </Link>
                            .
                        </p>
                    </div>
                </article>
            </main>
        </div>
    )
}
