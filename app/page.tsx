import Link from "next/link";
import Image from "next/image";
import { Gluten } from "next/font/google";

const gluten = Gluten({
    variable: "--font-gluten",
    subsets: ["latin"],
});

export default function WelcomePage() {
    return (
        <main className={`${gluten.variable} relative min-h-screen overflow-hidden bg-[#faf7f0]`}>
            {/* Hero content */}
            <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-24 pb-24 text-center sm:pt-32">
                <h1 className="max-w-3xl font-[family-name:var(--font-gluten)] text-4xl font-semibold text-[#30392d] sm:text-7xl">
                    Welcome to Trinket Troop
                </h1>

                <Link
                    href="/apply"
                    className="mt-8 w-full max-w-xs rounded-lg bg-[#7c9272] px-6 py-3 font-medium text-white transition hover:bg-[#667b5f] sm:w-auto"
                >
                    Join the waiting list
                </Link>

                <Link
                    href="/troop"
                    className="mt-3 w-full max-w-xs rounded-lg border border-[#7c9272] bg-[#fffdf9] px-6 py-3 font-medium text-[#5f7258] transition hover:bg-[#f0f2e9] hover:text-[#455442] sm:w-auto"
                >
                    Already a member? Open the app
                </Link>

                <Link
                    href="/beta/apply"
                    className="mt-3 text-sm font-medium text-[#5f7258] underline decoration-[#87977d] underline-offset-4 transition hover:text-[#455442]"
                >
                    Invited to the beta? Apply here.
                </Link>

                <div className="mt-12 w-full max-w-2xl overflow-hidden rounded-2xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm">
                    <Image
                        src="/trinkets-photo.png"
                        alt="A handful of cherished secondhand trinkets"
                        width={1200}
                        height={630}
                        className="h-auto w-full"
                        priority
                    />
                </div>
            </div>
        </main>
    );
}
