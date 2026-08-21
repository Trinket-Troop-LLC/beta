import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards a /troop/* route: must be logged in AND have an actual member
 * profile (created only via applicant approval — being logged in alone isn't
 * enough, since /auth/sign-up is still public). Any role gets through; admin
 * is a superset of member access, not a separate account.
 *
 * Wrapped in React's `cache()` so calling this from both the shared
 * (beta-app) layout and a page's own content component -- which is the
 * normal pattern, since a layout can't hand fetched data down to `page.tsx`
 * as props -- collapses to a single auth check and profile query per
 * request instead of re-running them per call site.
 */
export const requireMember = cache(async function requireMember() {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: profile } = await db
        .from('users')
        .select('id, username, role')
        .eq('id', user.id)
        .maybeSingle()

    if (!profile) {
        redirect('/')
    }

    return { db, user, profile }
})
