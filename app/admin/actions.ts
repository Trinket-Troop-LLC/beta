'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type ApplicantStatus, isApplicantStatus } from './applicant-status'
import { sendApprovalText } from '@/lib/sms/notifications/approval'

// Creates the real account for an approved applicant, but doesn't email them —
// that happens separately, later, once the beta app is actually ready to use.
// (Deliberately not generating a sign-in link here either: Supabase invite/magic
// links expire, so one generated now would be dead by the time it's sent. The
// future "notify approved users" flow should generate a fresh link at send time.)
async function ensureAccountExists(applicant: {
    id: string
    email: string
    username: string
    responses: unknown
    first_name: string
    last_name: string
    phone_number: string
    preferred_name: string
}): Promise<{ isNewAccount: boolean; authUserId: string | null }> {
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
        await markApplicantConverted(admin, applicant.id)
        return { isNewAccount: false, authUserId: null }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: applicant.email,
        email_confirm: false,
    })

    let authUserId = created?.user?.id
    let isNewAccount = true

    if (createError) {
        if (createError.code !== 'email_exists') {
            throw new Error(createError.message)
        }

        isNewAccount = false

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

        await markApplicantConverted(admin, applicant.id)
        return { isNewAccount: false, authUserId: null }
    }

    const { error: insertUserError } = await admin.from('users').insert({
        id: authUserId,
        email: applicant.email,
        username: applicant.username,
        role: 'user',
        applicant_id: applicant.id,
        responses: applicant.responses,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        phone_number: applicant.phone_number,
        preferred_name: applicant.preferred_name,
    })

    if (insertUserError) {
        throw new Error(`Account was created but the profile could not be saved: ${insertUserError.message}`)
    }

    // Best-effort: a hiccup here is logged, never thrown, so a broken welcome
    // friendship/chat can't roll back an otherwise-successful account
    // creation (see the rollback-on-failure note below this function).
    await createAdminWelcome(admin, authUserId)

    await markApplicantConverted(admin, applicant.id)

    // Only report an authUserId for rollback purposes if we actually created
    // the auth account ourselves in this call — never report one for an
    // already-existing account, so a later failure can't delete someone
    // else's real, pre-existing account.
    return { isNewAccount, authUserId: isNewAccount ? authUserId : null }
}

// Gives a brand-new member an already-accepted friendship with the official
// Trinket Troop account, plus an active welcome chat, so they land with a
// familiar face and someone to message right away. Uses the admin client
// directly rather than the friendship/conversation helpers built for a
// logged-in caller (sendFriendRequest, startActiveConversation) -- this runs
// in the context of whichever admin clicked Approve, not the Trinket Troop
// account itself, so those would create the friendship/chat with the wrong
// person. Never throws: every failure here is logged and swallowed so a
// broken welcome can't block or roll back the account creation it's attached to.
async function createAdminWelcome(admin: ReturnType<typeof createAdminClient>, newUserId: string) {
    try {
        const { data: officialAccount, error: officialAccountError } = await admin
            .from('users')
            .select('id')
            .eq('username', 'admin')
            .maybeSingle()

        if (officialAccountError || !officialAccount) {
            console.error('Could not find the official Trinket Troop account for auto-welcome:', officialAccountError)
            return
        }

        const officialAccountId = officialAccount.id

        const { data: existingFriendship } = await admin
            .from('friendships')
            .select('id, status')
            .or(`and(requester_id.eq.${officialAccountId},addressee_id.eq.${newUserId}),and(requester_id.eq.${newUserId},addressee_id.eq.${officialAccountId})`)
            .maybeSingle()

        if (!existingFriendship) {
            const { error: friendshipError } = await admin.from('friendships').insert({
                requester_id: officialAccountId,
                addressee_id: newUserId,
                status: 'accepted',
            })

            if (friendshipError) {
                console.error('Could not create the auto-welcome friendship:', friendshipError)
            }
        } else if (existingFriendship.status !== 'accepted') {
            await admin.from('friendships').update({ status: 'accepted' }).eq('id', existingFriendship.id)
        }

        const { data: existingConversation } = await admin
            .from('conversations')
            .select('id')
            .or(`and(participant_one_id.eq.${officialAccountId},participant_two_id.eq.${newUserId}),and(participant_one_id.eq.${newUserId},participant_two_id.eq.${officialAccountId})`)
            .maybeSingle()

        if (!existingConversation) {
            const { error: conversationError } = await admin.from('conversations').insert({
                participant_one_id: officialAccountId,
                participant_two_id: newUserId,
                origin_type: 'direct',
                origin_id: null,
                status: 'active',
                initiated_by: officialAccountId,
            })

            if (conversationError) {
                console.error('Could not create the auto-welcome conversation:', conversationError)
            }
        }
    } catch (error) {
        console.error('Auto-welcome (friendship/chat) failed unexpectedly:', error)
    }
}

async function rollbackNewAccount(admin: ReturnType<typeof createAdminClient>, authUserId: string) {
    // public.users first — its foreign key doesn't matter for auth.users deletion,
    // but cleaning up our own table before touching auth is the safer order.
    const { error: usersError } = await admin.from('users').delete().eq('id', authUserId)

    if (usersError) {
        console.error('Could not roll back users row after failed approval', { authUserId, usersError })
    }

    const { error: authError } = await admin.auth.admin.deleteUser(authUserId)

    if (authError) {
        console.error('Could not roll back auth account after failed approval', { authUserId, authError })
    }
}

// applicants.converted exists in the schema but nothing has ever set it — keep it
// truthful now that account creation actually happens. Not a hard failure if this
// write fails: the account itself is already real, this is just a status flag.
async function markApplicantConverted(admin: ReturnType<typeof createAdminClient>, applicantId: string) {
    const { error } = await admin
        .from('applicants')
        .update({ converted: true })
        .eq('id', applicantId)

    if (error) {
        console.error('Could not mark applicant as converted', { applicantId, error })
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
        .select('id, email, phone_number, first_name, last_name, preferred_name, username, status, responses')
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
        let createdAuthUserId: string | null = null

        try {
            const { isNewAccount, authUserId } = await ensureAccountExists({
                id: applicant.id,
                email: applicant.email,
                username: applicant.username,
                responses: applicant.responses,
                first_name: applicant.first_name,
                last_name: applicant.last_name,
                phone_number: applicant.phone_number,
                preferred_name: applicant.preferred_name,
            })

            createdAuthUserId = authUserId

            const admin = createAdminClient()
            const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
                type: isNewAccount ? 'invite' : 'magiclink',
                email: applicant.email,
            })

            if (linkError || !linkData) {
                throw new Error(linkError?.message ?? 'Could not generate an invite link.')
            }

            const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=${isNewAccount ? 'invite' : 'magiclink'}&next=/auth/update-password`
            console.log('INVITE LINK (testing):', inviteLink)
            // NEED TO SET UP RESEND
            // await sendApprovalEmail({
            //     applicantId: applicant.id,
            //     email: applicant.email,
            //     firstName: applicant.first_name,
            //     preferredName: applicant.preferred_name, 
            //     inviteLink
            // })
            await sendApprovalText({
                phoneNumber: applicant.phone_number,
                firstName: applicant.first_name,
                preferredName: applicant.preferred_name,
                inviteLink,
            })
        } catch (error) {
            const admin = createAdminClient()

            if (createdAuthUserId) {
                await rollbackNewAccount(admin, createdAuthUserId)
            }

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
