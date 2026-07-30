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
                <Image
                    src="/image/Logo_v2.png"
                    alt="Trinket Troop Logo"
                    width={220}
                    height={220}
                    priority
                    className="mx-auto mb-6"
                />
                <h1 className="font-gluten text-5xl font-semibold tracking-tight text-[#30392d] sm:text-6xl">
                    join trinket troop
                </h1>
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
                    Help us shape a friendlier way to buy, sell, and trade
                    secondhand treasures with people in your neighborhood.
                </p>
            </div>
        </section>
    );
}
