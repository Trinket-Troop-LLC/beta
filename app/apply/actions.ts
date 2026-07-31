'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const generalInterestSchema = z.object({
    first_name: z.string().trim().min(1, 'First name is required').max(100),
    last_name: z.string().trim().min(1, 'Last name is required').max(100),
    email: z.string().trim().email('Please enter a valid email').max(320),
    phone_number: z.string().trim().min(1, 'Phone number is required').max(50),
    pain_points: z.string().trim().min(1, 'Pain points are required').max(3000),
    friend_emails: z.string().max(2000),
    website: z.string().max(200),
})

export async function submitGeneralInterest(formData: FormData) {
    const validationFields = generalInterestSchema.safeParse({
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        phone_number: formData.get('phone_number'),
        pain_points: formData.get('pain_points'),
        friend_emails: formData.get('friend_emails') ?? '',
        website: formData.get('website') ?? '',
    })

    if (!validationFields.success) {
        return { success: false, error: validationFields.error.issues[0].message }
    }

    if (validationFields.data.website) {
        return { success: true }
    }

    const normalizedEmail = validationFields.data.email.toLowerCase()
    const friendEmails = [
        ...new Set(
            validationFields.data.friend_emails
                .split(/[\s,;]+/)
                .map((email) => email.trim().toLowerCase())
                .filter((email) => email && email !== normalizedEmail),
        ),
    ]

    if (friendEmails.length > 20) {
        return { success: false, error: 'Please enter no more than 20 friend email addresses' }
    }

    const friendEmailValidation = z.array(z.string().email()).safeParse(friendEmails)

    if (!friendEmailValidation.success) {
        return {
            success: false,
            error: 'Please check the friend email addresses and separate them with commas or new lines',
        }
    }

    const db = await createClient()
    const { first_name, last_name, phone_number, pain_points } = validationFields.data

    const { error } = await db.from('general_interest').insert({
        first_name,
        last_name,
        email: normalizedEmail,
        phone_number,
        pain_points,
        friend_emails: friendEmailValidation.data,
    })

    if (error) {
        if (error.code === '23505') {
            return { success: true }
        }

        console.error('General interest submission failed:', error.code)
        return {
            success: false,
            error: 'We could not join the waiting list right now. Please try again.',
        }
    }

    return { success: true }
}
