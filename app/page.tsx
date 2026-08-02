import Link from "next/link";
import { Gluten } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";

const gluten = Gluten({
    variable: "--font-gluten",
    subsets: ["latin"],
});

export default function Home() {
    return (
        <main className={`${gluten.variable} relative min-h-screen overflow-hidden bg-[#faf7f0]`}>
            <SiteHeader transparent />

            {/* Hero content */}
            <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-24 pb-64 text-center sm:pt-32">
                <h1 className="font-[family-name:var(--font-gluten)] text-5xl font-semibold text-[#30392d] sm:text-7xl">
                    Welcome to Trinket Troop
                </h1>

                <Link
                    href="/apply"
                    className="mt-8 rounded-lg bg-[#7c9272] px-6 py-3 font-medium text-white transition hover:bg-[#667b5f]"
                >
                    Join the waiting list
                </Link>

                <Link
                    href="/beta/apply"
                    className="mt-3 text-sm font-medium text-[#5f7258] underline decoration-[#87977d] underline-offset-4 transition hover:text-[#455442]"
                >
                    Invited to the beta? Apply here.
                </Link>
            </div>

            {/* Background video, anchored to bottom, faded upward */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[60vh] overflow-hidden">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    style={{ objectPosition: 'center 60%' }}
                >
                    <source src="/grass.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#faf7f0] to-transparent" />
            </div>
        </main>
    );
}