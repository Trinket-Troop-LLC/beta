import Image from 'next/image'
import Link from 'next/link'

export function MissionLogoHeader() {
    return (
        <header className="grid grid-cols-3 items-center border-b border-border px-6 pb-3 pt-3 sm:px-10 sm:pb-4 sm:pt-4 lg:px-10 lg:pb-3 lg:pt-3">
            <Link href="/" className="inline-block justify-self-start">
                <Image
                    src="/logo.png"
                    alt="Trinket Troop"
                    width={90}
                    height={90}
                    className="h-12 w-12 sm:h-14 sm:w-14 lg:h-11 lg:w-11"
                    priority
                />
            </Link>

            <Link
                href="/why-us"
                className="justify-self-center font-inter text-sm text-foreground transition hover:text-primary"
            >
                Mission
            </Link>

            <Link
                href="/about"
                className="justify-self-end font-inter text-sm text-foreground transition hover:text-primary"
            >
                About Us
            </Link>
        </header>
    )
}
