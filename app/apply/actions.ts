'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'


// validating inputs server side
const applicationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Please enter a valid email'),
    why_interested: z.string().min(1, 'This field is required'),
    how_heard: z.string().min(1, 'This field is required'),
})

export async function submitApplication(formData: FormData) {
    const db = await createClient()

    const { data: { user } } = await db.auth.getUser()
    console.log('Current user:', user)

    const validationFields = applicationSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        why_interested: formData.get('why_interested'),
        how_heard: formData.get('how_heard'),
    })

    if (!validationFields.success) {
        return { success: false, error: validationFields.error.issues[0].message }
    }

    const { name, email, ...responses} = validationFields.data

    const { error } = await db.from('applicants').insert({
        name, 
        email,
        responses,
    })

    if (error) {
        return { success: false, error: error.message}
    }

    return {success: true}
}