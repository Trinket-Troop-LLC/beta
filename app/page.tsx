import Link from "next/link";
import Image from "next/image";
import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { Suspense } from "react";
import { Gluten } from "next/font/google";

const gluten = Gluten({
    variable: "--font-gluten",
    subsets: ["latin"],
});

export default function Home() {
    return (
        <main className={`${gluten.variable} relative min-h-screen overflow-hidden bg-[#faf7f0]`}>
            {/* Nav */}
            <nav className="relative z-20 flex w-full items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2 font-semibold text-[#2c2c2c]">
                    <Image src="/logo.png" alt="Trinket Troupe logo" width={36} height={36} />
                    Trinket Troop
                </div>
                {!hasEnvVars ? (
                    <EnvVarWarning />
                ) : (
                    <Suspense>
                        <AuthButton />
                    </Suspense>
                )}
            </nav>

            {/* Hero content */}
            <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-24 pb-24 text-center sm:pt-32">
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

                <div className="mt-12 overflow-hidden rounded-2xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm">
                    <Image
                        src="/trinkets-photo.png"
                        alt="A handful of cherished secondhand trinkets"
                        width={1200}
                        height={630}
                        className="h-auto w-full max-w-2xl"
                        priority
                    />
                </div>
            </div>
        </main>
    );
}
