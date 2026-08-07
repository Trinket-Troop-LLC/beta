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
        <div className="mb-6 flex items-start gap-4">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border border-[#ded8cc] bg-[#f2ede0]">
                {profilePictureUrl ? (
                    <Image
                        src={profilePictureUrl}
                        alt={`${username}'s profile picture`}
                        width={200}
                        height={200}
                        className="size-full object-cover"
                    />
                ) : (
                    <UserRound className="size-10 text-[#9aaa90]" />
                )}
            </div>

            <div>
                <p className="text-xl font-semibold text-[#30392d]">@{username}</p>
                {preferredName && (
                    <p className="text-sm text-[#7c8072]">{preferredName}</p>
                )}
            </div>
        </div>
    )
}