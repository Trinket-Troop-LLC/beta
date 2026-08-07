import Image from 'next/image'
import { UserRound } from 'lucide-react'

export function ProfileHeader({
    username,
    preferredName,
    profilePictureUrl,
}: {
    username: string
    preferredName: string | null
    profilePictureUrl: string | null
}) {
    return (
        <div className="mb-6 flex items-start gap-4 text-left">
            <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                {profilePictureUrl ? (
                    <Image
                        src={profilePictureUrl}
                        alt={`${username}'s profile picture`}
                        width={128}
                        height={128}
                        className="size-full object-cover"
                    />
                ) : (
                    <UserRound className="size-12 text-[#9aaa90]" />
                )}
            </div>

            <div className="pt-1">
                <p className="text-xl font-semibold text-[#30392d]">@{username}</p>
                {preferredName && (
                    <p className="text-sm text-[#7c8072]">{preferredName}</p>
                )}
            </div>
        </div>
    )
}