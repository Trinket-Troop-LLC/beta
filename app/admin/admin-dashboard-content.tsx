import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import {
    AdminDashboardClient,
    type Applicant,
    type GeneralInterest,
    type Member,
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
        { data: members, error: membersError },
    ] = await Promise.all([loadApplicants(db), loadGeneralInterests(db), loadMembers()])

    if (applicantsError || generalInterestsError || membersError) {
        const message = applicantsError?.message ?? generalInterestsError?.message ?? membersError?.message
        return <p className="py-10 text-center text-red-600">Error loading applications: {message}</p>
    }

    const applicantsWithProfilePictures = await addProfilePictureUrls(db, applicants ?? [])

    return (
        <div className="min-h-screen bg-[#faf7f0] px-4 py-10">
            <div className="mx-auto max-w-[1400px]">
                <h1 className="mb-6 text-center text-2xl font-bold text-[#2c2c2c]">
                    Community Signups
                </h1>
                <AdminDashboardClient
                    applicants={applicantsWithProfilePictures}
                    generalInterests={generalInterests ?? []}
                    members={members ?? []}
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

// last_sign_in_at lives on auth.users, not public.users, so it's only
// reachable through the admin (service-role) client's auth.admin API --
// never via a normal table select.
async function loadAuthLastSignIns() {
    const admin = createAdminClient()
    const lastSignInById = new Map<string, string | null>()

    for (let page = 1; ; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize })

        if (error) {
            return { data: null, error }
        }

        for (const authUser of data.users) {
            lastSignInById.set(authUser.id, authUser.last_sign_in_at ?? null)
        }

        if (data.users.length < pageSize) {
            return { data: lastSignInById, error: null }
        }
    }
}

async function loadMembers(): Promise<{ data: Member[] | null; error: { message: string } | null }> {
    const admin = createAdminClient()
    const members: Member[] = []

    const { data: lastSignInById, error: authError } = await loadAuthLastSignIns()

    if (authError) {
        return { data: null, error: authError }
    }

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await admin
            .from('users')
            .select('id, username, email, role, created_at')
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1)

        if (error) {
            return { data: null, error }
        }

        for (const row of data ?? []) {
            members.push({
                id: row.id,
                username: row.username,
                email: row.email,
                role: row.role,
                createdAt: row.created_at,
                lastSignInAt: lastSignInById?.get(row.id) ?? null,
            })
        }

        if (!data || data.length < pageSize) {
            return { data: members, error: null }
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
