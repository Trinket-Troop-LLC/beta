import { Gluten } from 'next/font/google'
import Image from 'next/image'

const gluten = Gluten({
    variable: "--font-gluten",
    subsets: ["latin"],
})

export function ApplyHero() {
    return (
        <section className={`${gluten.variable} px-4 pb-8 pt-12 text-center sm:px-6 sm:pt-16`}>
            <div className="mx-auto max-w-3xl">
                <div className="mb-4 mt-4 inline-flex items-center gap-2 rounded-full bg-[#e4e8d8] px-4 py-2 text-sm font-medium text-[#5f7258]">
                    Beta Access
                </div>

                <Image
                    src="/logo.png"
                    alt="Trinket Troop Logo"
                    width={200}
                    height={200}
                    className="mx-auto mb-6"

                />

                <h1 className="font-[family-name:var(--font-gluten)] font-semibold tracking-tight text-[#30392d] sm:text-6xl">
                    Join Trinket Troop
                </h1>

                <div className="my-5 flex items-center justify-center gap-3 text-[#87977d]">
                    <div className="h-px w-12 bg-[#aab7a0]" />
                    <div className="h-px w-12 bg-[#aab7a0]" />
                </div>

                <p className="mx-auto max-w-2xl text-base leading-7 text-[#625f58] sm:text-lg">
                    hii :) welcome to the trinket troop! we are so glad 2 have you here. 
                </p>
                <br></br>
                <p className="mx-auto max-w-2xl text-base leading-7 text-[#625f58] sm:text-lg">
                    at the core of our mission is creating a community of New Yorkers who buy, sell, trade, and gift with intention, accountability, and care. we understand that we only have things to gain from integrating our social networks into the rehoming and procuring of the items we use to conduct our lives and bring us joy.
                </p>
                <br></br>
                <p className="mx-auto max-w-2xl text-base leading-7 text-[#625f58] sm:text-lg">
                    our first big project for this community is the creation of our app, which our engineers are working away at as you fill out this form.
                </p>
                <br></br>
                <p className="mx-auto max-w-2xl text-base leading-7 text-[#625f58] sm:text-lg">
                    join us as we build out the future of peer-to-peer second-hand exchange in the city we love by filling out your information below. when the beta is ready to launch, we will create a profile for you using this information and send you a link to download (eek!) all we ask from you is that you use the app in earnest and let us know what works (and doesn’t!).
                </p>
                <br></br>
                <p className="mx-auto max-w-2xl text-base leading-7 text-[#625f58] sm:text-lg">
                    a quick note: we are on a very tight launch timeline due to work visa requirements; a crucial part of the visa application involves demonstrated interest and an active customer-base. thus, we are starting user testing earlier than a lot of our features will be ready. but we have so much in the pipeline for u.
                </p>
            </div>
        </section>
    );
}
