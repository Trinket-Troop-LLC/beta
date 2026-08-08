// app/profile/page.tsx
import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { SwitchProfileTab } from './profile-tabs'
import { ProfileHeader } from '@/components/profile-header'
import { ProfileViewSwitcher } from './profile-view-switcher'
import { MyTroop } from './my-troop'

async function ProfileContent() {
    const { profile, db, user } = await requireMember()
    const { data: fullProfile} = await db
        .from('users')
        .select('email, first_name, preferred_name, username, responses, created_at')
        .eq('id', user.id)
        .single()
    
    let profilePictureUrl: string | null = null
    const picturePath = fullProfile?.responses?.profile_picture_path

    // temp window to see pfp from db
    if (picturePath) {
        const { data: signedUrlData } = await db.storage
            .from('beta-profile-pictures')
            .createSignedUrl(picturePath, 60 * 60)
        profilePictureUrl = signedUrlData?.signedUrl ?? null
    }

    // all friendship rows
    const { data: fullMyTroop } = await db
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    console.log('Logged in as:', user.id)
    console.log('Friendship rows found:', fullMyTroop)

    // grabbing friend's id
    const friendIds = fullMyTroop?.map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id) ?? []
    console.log('Friend IDs:', friendIds)
    const { data: fullFriendsProfiles } = await db
        .from('users')
        .select('id, username, responses')
        .in('id', friendIds)
    console.log('Friend profiles found:', fullFriendsProfiles)
    
    // loops through each friend, returns array of signed urls
    const paths = fullFriendsProfiles?.map((friend) => friend.responses?.profile_picture_path) ?? []
    // only takes not null paths
    const validPaths = paths.filter((path) => path !== null)
    // batch sign them for efficiency
    const { data: signedUrlResults } = await db.storage
        .from('beta-profile-pictures')
        .createSignedUrls(validPaths,  3600)
    console.log('Signed URL results:', signedUrlResults)
    // match the signed url with the friends
    const friendsWithPictures = fullFriendsProfiles?.map((friend) => {
        const path = friend.responses?.profile_picture_path
        const match = signedUrlResults?.find((result) => result.path === path)
        return {
            id: friend.id, 
            username: friend.username, 
            profilePictureUrl: match?.signedUrl ?? null,
        }
    }) ?? []

    return (
        <>
            <ProfileViewSwitcher
                profileView={
                    <>
                        <ProfileHeader
                            username={fullProfile?.username ?? profile.username}
                            preferredName={fullProfile?.preferred_name || fullProfile?.first_name}
                            profilePictureUrl={profilePictureUrl}
                        />
                        <SwitchProfileTab userId={profile.id} aboutData={fullProfile}/>
                    </>
                }
                troopView={
                    <MyTroop 
                        userId={profile.id} 
                        friendsData={friendsWithPictures}
                    />
                }


            />
        </>
    )
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