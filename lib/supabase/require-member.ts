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
 */
export async function requireMember() {
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
    
    db.from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', user.id)
        .or(`last_active_at.is.null,last_active_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`)
        .then()    
    
    return { db, user, profile }
}
