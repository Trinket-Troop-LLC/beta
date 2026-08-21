import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards a /troop/* route: must be logged in AND have an actual member
 * profile (created only via applicant approval — being logged in alone isn't
 * enough, since /auth/sign-up is still public). Any role gets through; admin
 * is a superset of member access, not a separate account.
 *
 * Call this from inside the Suspense-wrapped async content component of each
 * page, not from a shared layout — Cache Components mode requires dynamic
 * data access to happen inside a Suspense boundary, and layouts aren't
 * automatically wrapped in one.
 *
 * Uses getSession() (reads the cookie locally) instead of getUser() (a network
 * round-trip to Supabase's auth server) purely to decide which redirect to
 * throw on a cold/tampered session — this runs on every navigation, and that
 * round-trip was doubling latency for no security benefit. The actual
 * authorization boundary is still the profile query below: it's evaluated by
 * PostgREST against the real, signature-verified JWT via RLS (auth.uid() = id),
 * so a forged or stale local session can't read another user's row — it just
 * comes back empty and falls through to the same redirect as "not logged in."
 */
export async function requireMember() {
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

    return { db, user: session.user, profile }
}
