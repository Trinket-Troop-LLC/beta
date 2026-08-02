import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Gluten } from "next/font/google";
import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";

const gluten = Gluten({
    variable: "--font-gluten",
    subsets: ["latin"],
});

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
    return (
        <header
            className={
                transparent
                    ? `${gluten.variable} relative z-20 bg-transparent`
                    : `${gluten.variable} border-b border-[#ded8cc]/70 bg-[#faf7f0]/90`
            }
        >
            <div className="flex h-20 w-full items-center justify-between px-6 sm:px-10 lg:px-16">
                <Link href="/" className="flex items-center gap-3">
                    <Image src="/logo.png" alt="Trinket Troupe logo" width={40} height={40} />
                    <span className="font-[family-name:var(--font-gluten)] text-2xl font-semibold leading-none text-[#30392d]">
                        trinket troop
                    </span>
                </Link>

                {!hasEnvVars ? (
                    <EnvVarWarning />
                ) : (
                    <Suspense>
                        <AuthButton />
                    </Suspense>
                )}
            </div>
        </header>
    );
}