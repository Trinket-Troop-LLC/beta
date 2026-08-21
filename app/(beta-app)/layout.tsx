import { requireMember } from '@/lib/supabase/require-member'
import { BetaBottomNav } from '@/components/beta-bottom-nav'

// Every route under (beta-app) independently called requireMember() for its
// own auth/member check, then rendered <BetaBottomNav /> again -- so every
// tab switch re-ran the same auth.getUser() + profile query from scratch,
// with no shared layout to let Next.js skip re-fetching it on navigation.
// Doing the check once here means requireMember() (cache()-wrapped) only
// does real work once per request; pages that also call it directly for
// their own db/user/profile reuse this same call instead of re-querying.
export default async function BetaAppLayout({ children }: { children: React.ReactNode }) {
    await requireMember()

    return (
        <>
            {children}
            <BetaBottomNav />
        </>
    )
}
