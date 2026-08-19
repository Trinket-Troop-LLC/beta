'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const emailSchema = z.string().trim().email().max(320)
const usersPerPage = 1000

export type PasswordResetAccountResult =
    | { exists: true }
    | { exists: false; error: string }

export async function checkPasswordResetAccount(
    email: string,
): Promise<PasswordResetAccountResult> {
    const parsedEmail = emailSchema.safeParse(email)

    if (!parsedEmail.success) {
        return { exists: false, error: 'Please enter a valid email address.' }
    }

    const normalizedEmail = parsedEmail.data.toLowerCase()

    try {
        const admin = createAdminClient()

        for (let page = 1; ; page += 1) {
            const { data, error } = await admin.auth.admin.listUsers({
                page,
                perPage: usersPerPage,
            })

            if (error) {
                console.error('Password reset account lookup failed:', error.code)
                return {
                    exists: false,
                    error: 'We could not check that account right now. Please try again.',
                }
            }

            const accountExists = data.users.some(
                (user) => user.email?.trim().toLowerCase() === normalizedEmail,
            )

            if (accountExists) {
                return { exists: true }
            }

            if (data.users.length < usersPerPage) {
                return {
                    exists: false,
                    error: 'No account exists with that email.',
                }
            }
        }
    } catch (error) {
        console.error(
            'Password reset account lookup failed unexpectedly:',
            error instanceof Error ? error.message : 'Unknown error',
        )
        return {
            exists: false,
            error: 'We could not check that account right now. Please try again.',
        }
    }
}
