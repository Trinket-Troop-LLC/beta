import Link from "next/link";
import { House } from "lucide-react";

export function SiteHeader() {
    return (
        <header className="border-b border-[#ded8cc]/70 bg-[#faf7f0]/90">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#87977d] bg-[#f2f3e8] text-[#5f7258]">
                        <House className="size-5" />
                    </div>

                    <div className="leading-none">
                        <p className="font-serif text-xl font-semibold text-[#30392d]">
                            trinket
                        </p>
                        <p className="font-serif text-xl font-semibold text-[#30392d]">
                            troop
                        </p>
                    </div>
                </Link>

            <div className="flex items-center gap-4">
                <p className="hidden text-sm text-[#6c655d] sm:block">
                    Already have an account?
                </p>

                <Link
                    href="/auth/login"
                    className="rounded-lg border border-[#9aaa90] px-4 py-2 text-sm font-medium text-[#455442] transition hover:bg-[#edf0e7]"
                >
                    Log in
                </Link>
            </div>
        </div>
        </header>
    );
}