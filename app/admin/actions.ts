'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function updateApplicantStatus(applicantId: string, status: 'approved' | 'rejected') {

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

    // after verified admin, allow them to change the status
    const { data: applicants, error } = await db
        .from('applicants')
        .update({ status: status})
        .eq('id', applicantId)

    revalidatePath('/admin')

    
    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}