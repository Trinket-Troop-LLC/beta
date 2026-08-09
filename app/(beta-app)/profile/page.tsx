import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { ProfileSection } from './profile-section'
import { ProfileViewSwitcher } from './profile-view-switcher'
import { MyTroop } from './my-troop'

async function ProfileContent() {
    const { profile, db, user } = await requireMember()
    const { data: fullProfile } = await db
        .from('users')
        .select('email, first_name, preferred_name, username, responses, created_at')
        .eq('id', user.id)
        .single()

    let profilePictureUrl: string | null = null
    const picturePath = fullProfile?.responses?.profile_picture_path

    if (picturePath) {
        const { data: signedUrlData } = await db.storage
            .from('beta-profile-pictures')
            .createSignedUrl(picturePath, 60 * 60)
        profilePictureUrl = signedUrlData?.signedUrl ?? null
    }

    // accepted friendships
    const { data: fullMyTroop } = await db
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const friendIds = fullMyTroop?.map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id) ?? []

    // outgoing (sent) requests — keep the friendship row id alongside each person's id
    const { data: outgoingRequests } = await db
        .from('friendships')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'pending')

    const outgoingMap = new Map(outgoingRequests?.map((row) => [row.addressee_id, row.id]) ?? [])
    const requestedFriendsIds = [...outgoingMap.keys()]

    // incoming (received) requests
    const { data: incomingRequests } = await db
        .from('friendships')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending')

    const incomingMap = new Map(incomingRequests?.map((row) => [row.requester_id, row.id]) ?? [])
    const incomingFriendsIds = [...incomingMap.keys()]

    const friendsWithPictures = await resolveProfilesWithPictures(db, friendIds)
    const outgoingWithPictures = (await resolveProfilesWithPictures(db, requestedFriendsIds))
        .map((person) => ({ ...person, friendshipId: outgoingMap.get(person.id)! }))
    const incomingWithPictures = (await resolveProfilesWithPictures(db, incomingFriendsIds))
        .map((person) => ({ ...person, friendshipId: incomingMap.get(person.id)! }))

    return (
        <>
            <ProfileViewSwitcher
                profileView={
                    <ProfileSection
                        username={fullProfile?.username ?? profile.username}
                        preferredName={fullProfile?.preferred_name || fullProfile?.first_name || null}
                        profilePictureUrl={profilePictureUrl}
                        responses={fullProfile?.responses ?? null}
                    />
                }
                troopView={
                    <MyTroop
                        userId={profile.id}
                        friendsData={friendsWithPictures}
                        outgoingRequests={outgoingWithPictures}
                        incomingRequests={incomingWithPictures}
                    />
                }
            />
        </>
    )
}

async function resolveProfilesWithPictures(db: Awaited<ReturnType<typeof requireMember>>['db'], ids: string[]) {
    const { data: profiles } = await db
        .from('users')
        .select('id, username, responses')
        .in('id', ids)

    const paths = profiles?.map((p) => p.responses?.profile_picture_path) ?? []
    const validPaths = paths.filter((path): path is string => Boolean(path))

    const { data: signedUrlResults } = validPaths.length > 0
        ? await db.storage.from('beta-profile-pictures').createSignedUrls(validPaths, 3600)
        : { data: [] }

    return profiles?.map((profile) => {
        const path = profile.responses?.profile_picture_path
        const match = signedUrlResults?.find((r) => r.path === path)
        return {
            id: profile.id,
            username: profile.username,
            profilePictureUrl: match?.signedUrl ?? null,
        }
    }) ?? []
}

export default function ProfilePage() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#faf7f0] px-4 pb-28 text-center">
            <Suspense fallback={null}>
                <ProfileContent />
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}