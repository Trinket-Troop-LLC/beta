import { Gluten } from 'next/font/google'
import Image from 'next/image'

const gluten = Gluten({
    variable: '--font-gluten',
    subsets: ['latin'],
})

export function GeneralInterestHero() {
    return (
        <section className={`${gluten.variable} px-4 pb-8 pt-12 text-center sm:px-6 sm:pt-16`}>
            <div className="mx-auto max-w-3xl">
                <div className="mb-4 mt-4 inline-flex items-center gap-2 rounded-full bg-[#e4e8d8] px-4 py-2 text-sm font-medium text-[#5f7258]">
                    General Interest
                </div>

                <Image
                    src="/logo.png"
                    alt="Trinket Troop Logo"
                    width={200}
                    height={200}
                    className="mx-auto mb-6"
                />

                <h1 className="font-[family-name:var(--font-gluten)] text-4xl font-semibold tracking-tight text-[#30392d] sm:text-6xl">
                    Join the Trinket Troop Waiting List
                </h1>

                <div className="my-5 flex items-center justify-center gap-3 text-[#87977d]">
                    <div className="h-px w-12 bg-[#aab7a0]" />
                    <div className="h-px w-12 bg-[#aab7a0]" />
                </div>

                <div className="space-y-5 text-left text-base leading-7 text-[#625f58] sm:text-lg">
                    <p>hii :) welcome to the trinket troop! we are so glad 2 have you here.</p>

                    <p>
                        at the core of our mission is creating a community of New Yorkers who buy, sell, trade, and gift with intention, accountability, and care. we understand that we only have things to gain from integrating our social networks into the rehoming and procuring of the items we use to conduct our lives and bring us joy.
                    </p>

                    <p>
                        our first big project for this community is the creation of our app, which our engineers are working away at as you fill out this form.
                    </p>

                    <p>
                        as we build out the future of peer-to-peer second-hand exchange in the city we love, join the waiting list by filling out your information below. stay up to date on new developments by following our instagram and support our mission by buying us a coffee (both linked at the bottom of this page)! when the app is ready to launch, we will send you the link to download and start exchanging!
                    </p>

                    <p>xoxo caro and martina</p>
                </div>
            </div>
        </section>
    )
}
