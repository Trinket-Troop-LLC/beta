import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminDashboardContent() {
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

    // after verified admin, load in applicants
    const { data: applicants, error } = await db
        .from('applicants')
        .select('*')
        .order('created_at', {ascending: true})

    if (error) {
        return { success: false, error: error.message}
    }

    return (
        <div>
            <h1>Pending Applications</h1>
            {applicants?.length === 0 && <p>No pending applications.</p>}
            {applicants?.map((applicant) => (
            <div key={applicant.id}>
                <p>Email: {applicant.email}</p>
                <p>Name: {applicant.name}</p>
                <p>Status: {applicant.status}</p>
                <pre>{JSON.stringify(applicant.responses, null, 2)}</pre>
            </div>
            ))}
        </div>
    )
}