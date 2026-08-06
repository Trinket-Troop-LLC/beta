// app/profile/page.tsx
import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { SwitchProfileTab } from './profile-tabs'

async function ProfileContent() {
    const { profile, db, user } = await requireMember()
    const { data: fullProfile} = await db
        .from('users')
        .select('email, username, responses, created_at')
        .eq('id', user.id)
        .single()

    return (
        <>
            <h1 className="mb-3 text-3xl font-semibold text-[#30392d]">Profile</h1>
            <p className="max-w-md text-[#625f58]">
                Welcome { profile.username }
            </p>
            <SwitchProfileTab userId={profile.id} aboutData={fullProfile}/>
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