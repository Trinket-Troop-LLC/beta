import type { Metadata } from 'next'
import Link from 'next/link'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export const metadata: Metadata = {
    title: 'SMS Terms of Service | Trinket Troop',
    description: 'Terms governing SMS and RCS messaging from Trinket Troop.',
}

const sectionClass = 'flex flex-col gap-3'
const headingClass = 'text-xl font-semibold text-[#30392d]'
const bodyClass = 'text-[#625f58]'
const linkClass = 'text-[#7c9272] underline hover:text-[#5f7258]'

export default function SmsTermsPage() {
    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <MissionLogoHeader />

            <main className="mx-auto max-w-3xl px-4 py-12">
                <article className="flex flex-col gap-8 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm sm:p-10">
                    <header className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold text-[#30392d] sm:text-3xl">
                            Trinket Troop SMS Terms of Service
                        </h1>
                        <p className="text-sm text-[#7c8072]">Last updated: August 20, 2026</p>
                    </header>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Service Description</h2>
                        <p className={bodyClass}>
                            Trinket Troop provides SMS and RCS messaging for account verification, trade and exchange
                            notifications, and service updates related to the Trinket Troop app, sent via our
                            messaging provider, Twilio.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Cancellation / Opt-Out</h2>
                        <p className={bodyClass}>
                            You may opt out of text messages at any time by replying STOP to any message. You&apos;ll
                            receive a one-time confirmation that you&apos;ve been unsubscribed. If you&apos;d like to
                            receive messages again, you&apos;ll need to re-enroll through the app.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Support / Help</h2>
                        <p className={bodyClass}>
                            Reply HELP to any message for assistance, or reach us directly at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>
                            .
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Carrier Liability</h2>
                        <p className={bodyClass}>Carriers are not liable for delayed or undelivered messages.</p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Message and Data Rates</h2>
                        <p className={bodyClass}>
                            Message and data rates may apply for messages sent to you from us and from you to us.
                            Message frequency varies depending on your trade activity. Contact your wireless provider
                            with questions about your specific plan.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Privacy</h2>
                        <p className={bodyClass}>
                            For details on how we collect, use, and share your information, see our{' '}
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
