import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminDashboardClient } from './admin-dashboard-client'

export default async function AdminDashboardContent() {
    const db = await createClient()

    // checks if user is real
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
        redirect('/auth/login')
    }

    // checks if user is an admin
    const { data: dbUser } = await db.from('users').select('role').eq('id', user.id).single()
    if (dbUser?.role !== 'admin') {
        redirect('/')
    }

    // queries all applicants
    const { data: applicants, error } = await db
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        return <p className="text-center text-red-600 py-10">Error loading applicants: {error.message}</p>
    }

    return (
        <div className="min-h-screen bg-[#faf7f0] px-4 py-10">
            <div className="mx-auto max-w-[1400px]">
                <h1 className="text-2xl font-bold mb-6 text-center text-[#2c2c2c]">Applications</h1>

                {applicants?.length === 0 ? (
                    <p className="text-center text-[#7c8072]">No applications yet.</p>
                ) : (
                    <AdminDashboardClient applicants={applicants} />
                )}
            </div>
        </div>
    )
}