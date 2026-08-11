import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
    title: "You're offline",
};

export default function OfflinePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf7f0] px-4 text-center">
            <Image
                src="/logo.png"
                alt=""
                width={96}
                height={96}
                className="mb-6 h-24 w-24"
            />

            <h1 className="text-2xl font-semibold text-[#30392d]">You're offline</h1>

            <p className="mt-2 max-w-sm text-[#625f58]">
                This page needs a connection to load. Reconnect and try again — anything
                you'd already opened will still work.
            </p>
        </main>
    );
}
