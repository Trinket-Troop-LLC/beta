import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
        redirect('/auth/login?next=/admin')
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

    const applicantsWithProfilePictures = await addProfilePictureUrls(db, applicants ?? [])

    return (
        <div className="min-h-screen bg-background px-4 py-10">
            <div className="mx-auto max-w-[1400px]">
                <div className="mb-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <h1 className="text-center text-2xl font-bold text-foreground sm:text-left">
                        Community Signups
                    </h1>
                    <Link
                        href="/troop"
                        className="rounded-lg border border-primary bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        Open beta app
                    </Link>
                </div>
                <AdminDashboardClient
                    applicants={applicantsWithProfilePictures}
                    generalInterests={generalInterests ?? []}
                />
            </div>
        </div>
    )
}

async function addProfilePictureUrls(
    db: Awaited<ReturnType<typeof createClient>>,
    applicants: Applicant[],
) {
    const paths = [
        ...new Set(
            applicants
                .map((applicant) => applicant.responses?.profile_picture_path)
                .filter((path): path is string => typeof path === 'string' && path.length > 0),
        ),
    ]

    if (paths.length === 0) {
        return applicants
    }

    const urlByPath = new Map<string, string>()

    for (let start = 0; start < paths.length; start += 100) {
        const { data: signedPictures, error } = await db.storage
            .from('beta-profile-pictures')
            .createSignedUrls(paths.slice(start, start + 100), 60 * 60)

        if (error) {
            console.error('Could not sign a beta profile picture batch:', error.statusCode)
            continue
        }

        for (const picture of signedPictures) {
            if (picture.path && picture.signedUrl && !picture.error) {
                urlByPath.set(picture.path, picture.signedUrl)
            }
        }
    }

    return applicants.map((applicant) => {
        const path = applicant.responses?.profile_picture_path

        return {
            ...applicant,
            profile_picture_url: typeof path === 'string' ? urlByPath.get(path) ?? null : null,
        }
    })
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
            .select('id, first_name, last_name, email, phone_number, pain_points, friend_phone_numbers, created_at')
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
