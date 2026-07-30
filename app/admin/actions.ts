'use server'
import { createClient } from '@/lib/supabase/server'
import { sendApprovalEmail } from '@/lib/email/approval-email'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type ApplicantStatus, isApplicantStatus } from './applicant-status'

type UpdateApplicantStatusResult =
    | { success: true; emailSent: boolean }
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
        .select('id, email, first_name, preferred_name, status')
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
        return { success: true, emailSent: false }
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
            await sendApprovalEmail({
                applicantId: applicant.id,
                email: applicant.email,
                firstName: applicant.first_name,
                preferredName: applicant.preferred_name,
            })
        } catch (error) {
            // Restore the previous state so a failed email can be retried by
            // approving the applicant again.
            const { error: rollbackError } = await db
                .from('applicants')
                .update({ status: previousStatus })
                .eq('id', applicantId)
                .eq('status', 'approved')

            revalidatePath('/admin')

            const emailError = error instanceof Error
                ? error.message
                : 'The approval email could not be sent.'

            if (rollbackError) {
                console.error('Could not restore applicant status after email failure', {
                    applicantId,
                    rollbackError,
                })

                return {
                    success: false,
                    error: `${emailError} The applicant status could not be restored; refresh before retrying.`,
                }
            }

            return { success: false, error: emailError }
        }
    }

    revalidatePath('/admin')

    return { success: true, emailSent: status === 'approved' }
}
