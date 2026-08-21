import Image from 'next/image'
import { UserRound } from 'lucide-react'

export function Avatar({ username, profilePictureUrl }: { username: string; profilePictureUrl: string | null }) {
    return (
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
            {profilePictureUrl ? (
                <Image
                    src={profilePictureUrl}
                    alt={`${username}'s profile picture`}
                    width={80}
                    height={80}
                    className="size-full object-cover"
                />
            ) : (
                <UserRound className="size-8 text-[#9aaa90]" />
            )}
        </div>
    )
}