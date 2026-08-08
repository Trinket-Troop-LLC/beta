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
                troopView={<MyTroop userId={profile.id} />}


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