'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const emailSchema = z.string().trim().email().max(320)

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
        const { data, error } = await admin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .limit(1)

        if (error) {
            console.error('Password reset account lookup failed:', error.code)
            return {
                exists: false,
                error: 'We could not check that account right now. Please try again.',
            }
        }

        if (data.length === 0) {
            return {
                exists: false,
                error: 'No account exists with that email.',
            }
        }

        return { exists: true }
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
