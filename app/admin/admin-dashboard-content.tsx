import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
    AdminDashboardClient,
    type Applicant,
    type GeneralInterest,
} from './admin-dashboard-client'

const pageSize = 500

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

    const [
        { data: applicants, error: applicantsError },
        { data: generalInterests, error: generalInterestsError },
    ] = await Promise.all([loadApplicants(db), loadGeneralInterests(db)])

    if (applicantsError || generalInterestsError) {
        const message = applicantsError?.message ?? generalInterestsError?.message
        return <p className="py-10 text-center text-red-600">Error loading applications: {message}</p>
    }

    return (
        <div className="min-h-screen bg-[#faf7f0] px-4 py-10">
            <div className="mx-auto max-w-[1400px]">
                <h1 className="mb-6 text-center text-2xl font-bold text-[#2c2c2c]">
                    Community Signups
                </h1>
                <AdminDashboardClient
                    applicants={applicants ?? []}
                    generalInterests={generalInterests ?? []}
                />
            </div>
        </div>
    )
}

async function loadApplicants(db: Awaited<ReturnType<typeof createClient>>) {
    const applicants: Applicant[] = []

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await db
            .from('applicants')
            .select('*')
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1)

        if (error) {
            return { data: null, error }
        }

        applicants.push(...(data ?? []))

        if (!data || data.length < pageSize) {
            return { data: applicants, error: null }
        }
    }
}

async function loadGeneralInterests(db: Awaited<ReturnType<typeof createClient>>) {
    const generalInterests: GeneralInterest[] = []

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await db
            .from('general_interest')
            .select('id, first_name, last_name, email, phone_number, pain_points, friend_emails, created_at')
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1)

        if (error) {
            return { data: null, error }
        }

        generalInterests.push(...(data ?? []))

        if (!data || data.length < pageSize) {
            return { data: generalInterests, error: null }
        }
    }
}
