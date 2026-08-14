import Image from 'next/image'
import Link from 'next/link'

export function MissionLogoHeader() {
    return (
        <header className="px-6 pt-8 sm:px-10 sm:pt-10 lg:px-10 lg:pt-6">
            <Link href="/" className="inline-block">
                <Image
                    src="/logo.png"
                    alt="Trinket Troop"
                    width={90}
                    height={90}
                    className="h-16 w-16 sm:h-20 sm:w-20 lg:h-16 lg:w-16"
                    priority
                />
            </Link>
        </header>
    )
}
