import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards a /troop/* route: must be logged in AND have an actual member
 * profile (created only via applicant approval — being logged in alone isn't
 * enough, since /auth/sign-up is still public). Any role gets through; admin
 * is a superset of member access, not a separate account.
 *
 * Two layered optimizations, since this runs on every navigation:
 *
 * - Uses getSession() (reads the cookie locally) instead of getUser() (a
 *   network round-trip to Supabase's auth server) purely to decide which
 *   redirect to throw on a cold/tampered session. The actual authorization
 *   boundary is still the profile query below: it's evaluated by PostgREST
 *   against the real, signature-verified JWT via RLS (auth.uid() = id), so a
 *   forged or stale local session can't read another user's row — it just
 *   comes back empty and falls through to the same redirect as "not logged in."
 * - Wrapped in React's `cache()` so calling this from both the shared
 *   (beta-app) layout and a page's own content component -- which is the
 *   normal pattern, since a layout can't hand fetched data down to `page.tsx`
 *   as props -- collapses to a single call per request instead of re-running
 *   it per call site.
 */
export const requireMember = cache(async function requireMember() {
    const db = await createClient()
    const { data: { session } } = await db.auth.getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const { data: profile } = await db
        .from('users')
        .select('id, username, role')
        .eq('id', session.user.id)
        .maybeSingle()

    if (!profile) {
        redirect('/')
    }

    db.from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', session.user.id)
        .or(`last_active_at.is.null,last_active_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`)
        .then()

    return { db, user: session.user, profile }
})
