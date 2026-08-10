'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const generalInterestSchema = z.object({
    first_name: z.string().trim().min(1, 'First name is required').max(100),
    last_name: z.string().trim().min(1, 'Last name is required').max(100),
    email: z.string().trim().email('Please enter a valid email').max(320),
    phone_number: z.string()
        .trim()
        .transform((val) => val.replace(/\D/g, ''))
        .refine((digits) => digits.length === 10 || (digits.length === 11 && digits.startsWith('1')), {
            message: 'Please enter a valid 10-digit phone number',
        })
        .transform((digits) => digits.length === 11 ? `+${digits}` : `+1${digits}`),
    pain_points: z.string().trim().min(1, 'Pain points are required').max(3000),
    friend_phone_numbers: z.string().max(2000),
    website: z.string().max(200),
})

const phoneNumberPattern = /^[0-9+\-.() ]{7,50}$/

export async function submitGeneralInterest(formData: FormData) {
    const validationFields = generalInterestSchema.safeParse({
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        phone_number: formData.get('phone_number'),
        pain_points: formData.get('pain_points'),
        friend_phone_numbers: formData.get('friend_phone_numbers') ?? '',
        website: formData.get('website') ?? '',
    })

    if (!validationFields.success) {
        return { success: false, error: validationFields.error.issues[0].message }
    }

    if (validationFields.data.website) {
        return { success: true }
    }

    const normalizedEmail = validationFields.data.email.toLowerCase()
    const normalizedPhoneNumber = validationFields.data.phone_number.replace(/\D/g, '')
    const friendPhoneNumbers = [
        ...new Set(
            validationFields.data.friend_phone_numbers
                .split(/[,;\n]+/)
                .map((phone) => phone.trim())
                .filter((phone) => phone && phone.replace(/\D/g, '') !== normalizedPhoneNumber),
        ),
    ]

    if (friendPhoneNumbers.length > 20) {
        return { success: false, error: 'Please enter no more than 20 friend phone numbers' }
    }

    const friendPhoneValidation = z.array(z.string().regex(phoneNumberPattern)).safeParse(friendPhoneNumbers)

    if (!friendPhoneValidation.success) {
        return {
            success: false,
            error: 'Please check the friend phone numbers and separate them with commas or new lines',
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
        friend_phone_numbers: friendPhoneValidation.data,
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
