'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'


// validating inputs server side
const applicationSchema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    preferred_name: z.string().optional(),
    email: z.string().email('Please enter a valid email'),
    phone_number: z.string().min(1, 'Phone number is required'),
    neighborhood: z.string().min(1, 'This field is required'),
    emojis: z.string().min(1, 'This field is required'),
    what_trading: z.string().min(1, 'This field is required'),
    categories: z.array(z.string()).min(1, 'Select at least one category'),
    other_category: z.string().optional(),
    pain_points: z.string().min(1, 'This field is required'),
    future_features: z.string().min(1, 'This field is required'),
    referral_email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
    misc_thoughts: z.string().optional(),
})

export async function submitApplication(formData: FormData) {
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    console.log('Current user:', user)

    const validationFields = applicationSchema.safeParse({
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        preferred_name: formData.get('preferred_name'),
        email: formData.get('email'),
        phone_number: formData.get('phone_number'),
        neighborhood: formData.get('neighborhood'),
        emojis: formData.get('emojis'),
        what_trading: formData.get('what_trading'),
        categories: formData.getAll('categories'),
        other_category: formData.get('other_category'),
        pain_points: formData.get('pain_points'),
        future_features: formData.get('future_features'),
        referral_email: formData.get('referral_email'),
        misc_thoughts: formData.get('misc_thoughts'),
    })

    if (!validationFields.success) {
        return { success: false, error: validationFields.error.issues[0].message }
    }

    const { first_name, last_name, preferred_name, email, phone_number, ...responses } = validationFields.data

    const { error } = await db.from('applicants').insert({
        first_name, 
        last_name,
        preferred_name, 
        email,
        phone_number,
        responses,
    })

    if (error) {
        return { success: false, error: error.message}
    }

    return {success: true}
}