'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type ApplicantStatus, isApplicantStatus } from './applicant-status'

// Creates the real account for an approved applicant, but doesn't email them —
// that happens separately, later, once the beta app is actually ready to use.
// (Deliberately not generating a sign-in link here either: Supabase invite/magic
// links expire, so one generated now would be dead by the time it's sent. The
// future "notify approved users" flow should generate a fresh link at send time.)
async function ensureAccountExists(applicant: {
    id: string
    email: string
    username: string
}): Promise<void> {
    const admin = createAdminClient()

    const { data: existingUser, error: existingUserError } = await admin
        .from('users')
        .select('id')
        .eq('applicant_id', applicant.id)
        .maybeSingle()

    if (existingUserError) {
        throw new Error(`Could not check for an existing account: ${existingUserError.message}`)
    }

    if (existingUser) {
        return
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: applicant.email,
        email_confirm: false,
    })

    let authUserId = created?.user?.id

    if (createError) {
        // Someone can be approved while already having an auth account under this
        // email (most commonly an admin testing with their own email, but also a
        // real possible edge case). Rather than failing, link the existing auth
        // account to this applicant instead of creating a duplicate.
        if (createError.code !== 'email_exists') {
            throw new Error(createError.message)
        }

        const { data: existing, error: lookupError } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: applicant.email,
        })

        if (lookupError || !existing) {
            throw new Error(
                lookupError?.message ?? 'An account with this email already exists, but it could not be linked.',
            )
        }

        authUserId = existing.user.id
    }

    if (!authUserId) {
        throw new Error('Could not create an account for this applicant.')
    }

    // The auth account may already have its own public.users row (e.g. it's an
    // existing admin's account) — link this applicant to it via an update rather
    // than an insert, so we never overwrite an existing role or username.
    const { data: existingProfile, error: existingProfileError } = await admin
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle()

    if (existingProfileError) {
        throw new Error(`Could not check for an existing profile: ${existingProfileError.message}`)
    }

    if (existingProfile) {
        const { error: linkError } = await admin
            .from('users')
            .update({ applicant_id: applicant.id })
            .eq('id', authUserId)

        if (linkError) {
            throw new Error(`Account already existed but could not be linked: ${linkError.message}`)
        }

        return
    }

    const { error: insertUserError } = await admin.from('users').insert({
        id: authUserId,
        email: applicant.email,
        username: applicant.username,
        role: 'user',
        applicant_id: applicant.id,
    })

    if (insertUserError) {
        throw new Error(`Account was created but the profile could not be saved: ${insertUserError.message}`)
    }
}

type UpdateApplicantStatusResult =
    | { success: true; accountCreated: boolean }
    | { success: false; error: string }

export async function updateApplicantStatus(
    applicantId: string,
    status: ApplicantStatus,
): Promise<UpdateApplicantStatusResult> {
    const db = await createClient()

    // checking if the user is an admin
    const { data: { user } } = await db.auth.getUser()
    // if user doesn't exist
    if (!user) {
        redirect('/auth/login')
    }

    // grabbing the user from db with same id
    const { data: dbUser } = await db.from('users').select('role').eq('id', user.id).single()
    // if not admin, get booted
    if (dbUser?.role !== 'admin') {
        redirect('/')
    }

    const { data: applicant, error: applicantError } = await db
        .from('applicants')
        .select('id, email, first_name, preferred_name, username, status')
        .eq('id', applicantId)
        .single()

    if (applicantError || !applicant) {
        return {
            success: false,
            error: applicantError?.message ?? 'Applicant not found.',
        }
    }

    if (!isApplicantStatus(applicant.status)) {
        return { success: false, error: 'Applicant has an invalid current status.' }
    }

    const previousStatus = applicant.status

    if (previousStatus === status) {
        return { success: true, accountCreated: false }
    }

    // The current-status filter prevents one admin from overwriting another
    // admin's change if both update this applicant at the same time.
    const { data: updatedApplicant, error: updateError } = await db
        .from('applicants')
        .update({ status })
        .eq('id', applicantId)
        .eq('status', previousStatus)
        .select('id')
        .maybeSingle()

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    if (!updatedApplicant) {
        return {
            success: false,
            error: 'This application was changed by another admin. Please refresh and try again.',
        }
    }

    if (status === 'approved') {
        try {
            await ensureAccountExists({
                id: applicant.id,
                email: applicant.email,
                username: applicant.username,
            })
        } catch (error) {
            // Restore the previous state so a failed account-creation step can
            // be retried by approving the applicant again.
            const { error: rollbackError } = await db
                .from('applicants')
                .update({ status: previousStatus })
                .eq('id', applicantId)
                .eq('status', 'approved')

            revalidatePath('/admin')

            const approvalError = error instanceof Error
                ? error.message
                : 'The applicant could not be approved.'

            if (rollbackError) {
                console.error('Could not restore applicant status after approval failure', {
                    applicantId,
                    rollbackError,
                })

                return {
                    success: false,
                    error: `${approvalError} The applicant status could not be restored; refresh before retrying.`,
                }
            }

            return { success: false, error: approvalError }
        }
    }

    revalidatePath('/admin')

    return { success: true, accountCreated: status === 'approved' }
}
