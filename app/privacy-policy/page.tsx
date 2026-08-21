import type { Metadata } from 'next'
import Link from 'next/link'
import { MissionLogoHeader } from '@/components/mission/mission-logo-header'

export const metadata: Metadata = {
    title: 'Privacy Policy | Trinket Troop',
    description: 'How Trinket Troop collects, uses, and discloses your personal information.',
}

const sectionClass = 'flex flex-col gap-3'
const headingClass = 'text-xl font-semibold text-[#30392d]'
const subheadingClass = 'font-semibold text-[#2c2c2c]'
const bodyClass = 'text-[#625f58]'
const listClass = 'flex flex-col gap-2 pl-5 text-[#625f58]'
const linkClass = 'text-[#7c9272] underline hover:text-[#5f7258]'

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <MissionLogoHeader />

            <main className="mx-auto max-w-3xl px-4 py-12">
                <article className="flex flex-col gap-8 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm sm:p-10">
                    <header className="flex flex-col gap-1">
                        <h1 className="text-2xl font-semibold text-[#30392d] sm:text-3xl">
                            Trinket Troop Privacy Policy
                        </h1>
                        <p className="text-sm text-[#7c8072]">Last updated: August 20, 2026</p>
                    </header>

                    <div className={sectionClass}>
                        <p className={bodyClass}>
                            This Privacy Policy describes how Trinket Troop LLC (the &quot;Site,&quot; &quot;we,&quot;
                            &quot;us,&quot; or &quot;our&quot;) collects, uses, and discloses your personal information
                            when you visit or use our services at https://www.trinkettroop.com/ (the &quot;Site&quot;)
                            or otherwise communicate with us (collectively, the &quot;Services&quot;). For purposes of
                            this Privacy Policy, &quot;you&quot; and &quot;your&quot; means you as the user of the
                            Services, whether you are a member, website visitor, or another individual whose
                            information we have collected pursuant to this Privacy Policy.
                        </p>

                        <p className={bodyClass}>
                            Please read this Privacy Policy carefully. By using and accessing any of the Services, you
                            agree to the collection, use, and disclosure of your information as described in this
                            Privacy Policy. If you do not agree, please do not use or access the Services.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Changes to This Privacy Policy</h2>
                        <p className={bodyClass}>
                            We may update this Privacy Policy from time to time, including to reflect changes to our
                            practices or for other operational, legal, or regulatory reasons. We will post the revised
                            Privacy Policy on the Site and update the &quot;Last updated&quot; date.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>How We Collect and Use Your Personal Information</h2>
                        <p className={bodyClass}>
                            Trinket Troop is a community platform that lets New Yorkers barter, trade, gift, and
                            skill-share second-hand items with each other. To provide the Services, we collect
                            personal information from a variety of sources, as set out below. The information we
                            collect varies depending on how you interact with us.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>What Personal Information We Collect</h2>

                        <div className={sectionClass}>
                            <h3 className={subheadingClass}>Information you give us directly:</h3>
                            <ul className={`list-disc ${listClass}`}>
                                <li>Basic contact details, including your name, phone number, and email address, if applicable</li>
                                <li>Account information, including your username, password, and security questions</li>
                                <li>General location, such as your neighborhood or borough, to help match you with nearby trades</li>
                                <li>Listing information, including photos, descriptions, and categories of items or skills you post</li>
                                <li>Trade activity, including offers you make or receive and messages you send other members to coordinate a trade</li>
                                <li>Customer support information, including anything you include when you message us</li>
                            </ul>
                        </div>

                        <p className={bodyClass}>
                            Some features of the Services may require you to provide certain information about
                            yourself. You may elect not to provide it, but doing so may prevent you from using or
                            accessing those features.
                        </p>

                        <div className={sectionClass}>
                            <h3 className={subheadingClass}>Information we collect through cookies:</h3>
                            <p className={bodyClass}>
                                We automatically collect certain information about your interaction with the Site
                                (&quot;Usage Data&quot;) using cookies, pixels, and similar technologies &mdash;
                                primarily to keep you signed in and remember your session. Usage Data may include
                                device information, browser information, your IP address, and other information
                                about how you access and use the Site.
                            </p>
                        </div>

                        <div className={sectionClass}>
                            <h3 className={subheadingClass}>Information we obtain from third parties:</h3>
                            <p className={bodyClass}>
                                We may obtain information about you from vendors and service providers who support our
                                Site and Services, such as our hosting provider (Vercel), our database and account
                                infrastructure provider (Supabase), and our text-messaging provider (Twilio). Any
                                information we obtain from third parties is treated in accordance with this Privacy
                                Policy; we are not responsible for the accuracy of information provided to us by third
                                parties or for their own privacy practices.
                            </p>
                        </div>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>How We Use Your Personal Information</h2>
                        <ul className={`list-disc ${listClass}`}>
                            <li>
                                <span className={subheadingClass}>Providing the Services.</span> To create and manage
                                your account, connect you with other members for trades and skill-shares, send you
                                notifications related to your account or trade activity, and provide customer support.
                            </li>
                            <li>
                                <span className={subheadingClass}>Community Safety.</span> To detect, investigate, or
                                take action regarding fraudulent, unsafe, or abusive activity, and to help keep
                                in-person exchanges as safe as possible.
                            </li>
                            <li>
                                <span className={subheadingClass}>Communicating with You.</span> To respond to your
                                messages, provide support, and maintain our relationship with you.
                            </li>
                            <li>
                                <span className={subheadingClass}>Improving the Service.</span> To troubleshoot issues
                                and improve the Site and app, in our legitimate interest to operate a functional
                                product.
                            </li>
                        </ul>

                        <p className={bodyClass}>
                            Trinket Troop is currently in beta and limited to bartering &mdash; we do not currently
                            process payments or collect payment card information. If we introduce buying/selling
                            features in the future, this policy will be updated to describe how payment information is
                            collected and by whom.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Text Messaging (SMS/RCS)</h2>
                        <p className={bodyClass}>
                            If you provide your phone number and opt in, we&apos;ll send you text messages via our
                            provider, Twilio, including account verification codes and trade/exchange notifications.
                            Message frequency varies depending on your trade activity. Message and data rates may
                            apply.
                        </p>

                        <p className={bodyClass}>
                            We do not share or sell your mobile phone number, or your SMS opt-in consent, with third
                            parties or affiliates for their marketing or promotional purposes. Your phone number is
                            shared only with our messaging provider, Twilio, solely to deliver these messages on our
                            behalf.
                        </p>

                        <p className={bodyClass}>
                            You can opt out at any time by replying STOP, or get help by replying HELP. For full
                            details, see our separate{' '}
                            <Link href="/sms-terms" className={linkClass}>
                                SMS Terms of Service
                            </Link>
                            .
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Cookies</h2>
                        <p className={bodyClass}>
                            Like many websites, we use cookies on our Site to power and improve it, remember your
                            preferences, and run basic analytics in our legitimate interest to administer and optimize
                            the Services. Most browsers accept cookies by default, but you can set your browser to
                            remove or reject them &mdash; note this may affect site functionality.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>How We Disclose Personal Information</h2>
                        <p className={bodyClass}>We may disclose your personal information to:</p>
                        <ul className={`list-disc ${listClass}`}>
                            <li>Vendors who perform services on our behalf (e.g., Vercel for hosting, Supabase for our database and account infrastructure, Twilio for text messaging)</li>
                            <li>Other members, as necessary to facilitate a trade (e.g., your display name and general neighborhood, and any listing or message content you choose to share)</li>
                            <li>Our affiliates, in our legitimate interest to run the business</li>
                            <li>
                                Third parties, in connection with a business transaction (such as a merger), to comply
                                with legal obligations (subpoenas, warrants, and similar requests), to enforce our{' '}
                                <Link href="/terms-of-service" className={linkClass}>
                                    Terms of Service
                                </Link>
                                , or to protect the Services, our rights, or the rights of our members
                            </li>
                        </ul>

                        <p className={bodyClass}>
                            We do not sell your personal information, and we do not use or disclose it for targeted
                            advertising.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>User Generated Content</h2>
                        <p className={bodyClass}>
                            The Services let you post listings, photos, and trade offers. If you submit content to any
                            public area of the Services, it may be visible to other members. We do not control who has
                            access to information you make available to others and are not responsible for how they
                            use it.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Third-Party Websites and Links</h2>
                        <p className={bodyClass}>
                            Our Site may link to platforms operated by third parties (including Instagram). We
                            don&apos;t control and aren&apos;t responsible for the privacy practices of those sites
                            &mdash; check their own policies before sharing information there.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Children&apos;s Data</h2>
                        <p className={bodyClass}>
                            The Services are intended for users 18 years of age and older, and we do not knowingly
                            collect personal information from anyone under 18. If you&apos;re a parent or guardian and
                            believe your child has provided us with personal information, contact us at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>{' '}
                            and we&apos;ll delete it.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Security and Retention of Your Information</h2>
                        <p className={bodyClass}>
                            No security measures are perfect or impenetrable, and we can&apos;t guarantee &quot;perfect
                            security.&quot; We recommend you avoid sending sensitive information to us through
                            unsecured channels. How long we retain your information depends on factors like whether we
                            need it to maintain your account, provide the Services, or comply with legal obligations.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Your Rights and Choices</h2>
                        <p className={bodyClass}>
                            Depending on where you live, you may have rights to access, delete, correct, or receive a
                            copy of your personal information, or to withdraw consent where we rely on it. You can
                            exercise these by contacting us at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>
                            . We won&apos;t discriminate against you for exercising these rights, though we may need to
                            verify your identity first.
                        </p>
                    </div>

                    <div className={sectionClass}>
                        <h2 className={headingClass}>Contact Us</h2>
                        <p className={bodyClass}>
                            Questions about this Privacy Policy? Reach us at{' '}
                            <a href="mailto:hello@trinkettroop.com" className={linkClass}>
                                hello@trinkettroop.com
                            </a>
                            .
                        </p>
                    </div>
                </article>
            </main>
        </div>
    )
}
