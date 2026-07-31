'use client'

import { useState } from 'react'
import { StatusDropdown } from './status-dropdown'

const responseLabels: Record<string, string> = {
    neighborhood: 'Neighborhood',
    emojis: 'Emojis',
    what_trading: 'Buy/Sell/Trade',
    categories: 'Categories',
    other_category: 'Other Category',
    pain_points: 'Pain Points',
    future_features: 'Features Wanted',
    referral_email: 'Referral',
    misc_thoughts: 'Thoughts',
}

export type Applicant = {
    id: string
    first_name: string
    last_name: string
    preferred_name: string | null
    email: string
    phone_number: string
    status: string
    responses: Record<string, unknown>
}

export type GeneralInterest = {
    id: string
    first_name: string
    last_name: string
    email: string
    phone_number: string
    pain_points: string
    friend_emails: string[] | null
    created_at: string
}

type DashboardTab = 'beta' | 'general-interest'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'America/New_York',
})

function formatDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

function escapeCsvCell(value: unknown) {
    let text = Array.isArray(value) ? value.join('; ') : String(value ?? '')

    // Prevent spreadsheet software from evaluating user-provided cells as formulas.
    if (/^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text)) {
        text = `'${text}`
    }

    return `"${text.replaceAll('"', '""')}"`
}

export function AdminDashboardClient({
    applicants,
    generalInterests,
}: {
    applicants: Applicant[]
    generalInterests: GeneralInterest[]
}) {
    const [activeTab, setActiveTab] = useState<DashboardTab>('beta')
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
    const [selectedInterest, setSelectedInterest] = useState<GeneralInterest | null>(null)

    const thClass =
        'whitespace-nowrap border-b border-r border-[#ded8cc] px-4 py-3 text-center font-semibold text-[#2c2c2c] last:border-r-0'
    const tdClass =
        'align-middle border-b border-r border-[#ded8cc] px-4 py-3 text-center text-[#2c2c2c] last:border-r-0'

    function switchTab(tab: DashboardTab) {
        setActiveTab(tab)
        setSelectedApplicant(null)
        setSelectedInterest(null)
    }

    function exportGeneralInterests() {
        const headers = [
            'First Name',
            'Last Name',
            'Email',
            'Phone Number',
            'Pain Points',
            'Friend Emails',
            'Joined At',
        ]
        const rows = generalInterests.map((interest) => [
            interest.first_name,
            interest.last_name,
            interest.email,
            interest.phone_number,
            interest.pain_points,
            interest.friend_emails ?? [],
            interest.created_at,
        ])
        const csv = [
            headers.map(escapeCsvCell).join(','),
            ...rows.map((row) => row.map(escapeCsvCell).join(',')),
        ].join('\r\n')
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = `trinket-troop-general-interest-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
    }

    return (
        <div>
            <div
                className="mb-6 inline-flex rounded-xl border border-[#ded8cc] bg-[#fffdf9] p-1 shadow-sm"
                role="tablist"
                aria-label="Application lists"
            >
                <button
                    id="beta-applicants-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'beta'}
                    aria-controls="beta-applicants-panel"
                    onClick={() => switchTab('beta')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'beta'
                            ? 'bg-[#7c9272] text-white'
                            : 'text-[#455442] hover:bg-[#f2ede0]'
                    }`}
                >
                    Beta Applicants
                    <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
                        {applicants.length}
                    </span>
                </button>
                <button
                    id="general-interest-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'general-interest'}
                    aria-controls="general-interest-panel"
                    onClick={() => switchTab('general-interest')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        activeTab === 'general-interest'
                            ? 'bg-[#7c9272] text-white'
                            : 'text-[#455442] hover:bg-[#f2ede0]'
                    }`}
                >
                    General Interest
                    <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
                        {generalInterests.length}
                    </span>
                </button>
            </div>

            {activeTab === 'beta' ? (
                <section
                    id="beta-applicants-panel"
                    role="tabpanel"
                    aria-labelledby="beta-applicants-tab"
                >
                    {applicants.length === 0 ? (
                        <EmptyState message="No beta applications yet." />
                    ) : (
                        <div className="flex flex-col items-start gap-6 xl:flex-row">
                            <div
                                className={`overflow-x-auto rounded-2xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm transition-all ${
                                    selectedApplicant ? 'min-w-0 flex-1' : 'w-full'
                                }`}
                            >
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-[#f2ede0]">
                                            <th className={thClass}>First Name</th>
                                            <th className={thClass}>Last Name</th>
                                            <th className={thClass}>Email</th>
                                            <th className={thClass}>Phone</th>
                                            <th className={thClass}>Responses</th>
                                            <th className={thClass}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applicants.map((applicant) => (
                                            <tr
                                                key={applicant.id}
                                                className={`transition hover:bg-[#f7f3ea] ${
                                                    selectedApplicant?.id === applicant.id
                                                        ? 'bg-[#f2ede0]'
                                                        : ''
                                                }`}
                                            >
                                                <td className={tdClass}>{applicant.first_name}</td>
                                                <td className={tdClass}>{applicant.last_name}</td>
                                                <td className={tdClass}>{applicant.email}</td>
                                                <td className={tdClass}>{applicant.phone_number}</td>
                                                <td className={tdClass}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedApplicant(applicant)}
                                                        className="rounded-lg bg-[#7c9272] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#667b5f]"
                                                    >
                                                        View Responses
                                                    </button>
                                                </td>
                                                <td className={tdClass}>
                                                    <StatusDropdown
                                                        applicantId={applicant.id}
                                                        currentStatus={applicant.status}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedApplicant && (
                                <ApplicantDetails
                                    applicant={selectedApplicant}
                                    onClose={() => setSelectedApplicant(null)}
                                />
                            )}
                        </div>
                    )}
                </section>
            ) : (
                <section
                    id="general-interest-panel"
                    role="tabpanel"
                    aria-labelledby="general-interest-tab"
                >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[#625f58]">
                            Waiting-list signups do not require approval.
                        </p>
                        <button
                            type="button"
                            onClick={exportGeneralInterests}
                            disabled={generalInterests.length === 0}
                            className="rounded-lg border border-[#7c9272] bg-[#fffdf9] px-4 py-2 text-sm font-medium text-[#455442] transition hover:bg-[#edf0e7] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Export CSV
                        </button>
                    </div>

                    {generalInterests.length === 0 ? (
                        <EmptyState message="No general-interest signups yet." />
                    ) : (
                        <div className="flex flex-col items-start gap-6 xl:flex-row">
                            <div
                                className={`overflow-x-auto rounded-2xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm transition-all ${
                                    selectedInterest ? 'min-w-0 flex-1' : 'w-full'
                                }`}
                            >
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-[#f2ede0]">
                                            <th className={thClass}>First Name</th>
                                            <th className={thClass}>Last Name</th>
                                            <th className={thClass}>Email</th>
                                            <th className={thClass}>Phone</th>
                                            <th className={thClass}>Joined</th>
                                            <th className={thClass}>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generalInterests.map((interest) => (
                                            <tr
                                                key={interest.id}
                                                className={`transition hover:bg-[#f7f3ea] ${
                                                    selectedInterest?.id === interest.id
                                                        ? 'bg-[#f2ede0]'
                                                        : ''
                                                }`}
                                            >
                                                <td className={tdClass}>{interest.first_name}</td>
                                                <td className={tdClass}>{interest.last_name}</td>
                                                <td className={tdClass}>{interest.email}</td>
                                                <td className={tdClass}>{interest.phone_number}</td>
                                                <td className={tdClass}>
                                                    {formatDate(interest.created_at)}
                                                </td>
                                                <td className={tdClass}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedInterest(interest)}
                                                        className="rounded-lg bg-[#7c9272] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#667b5f]"
                                                    >
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {selectedInterest && (
                                <GeneralInterestDetails
                                    interest={selectedInterest}
                                    onClose={() => setSelectedInterest(null)}
                                />
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-10 text-center text-[#7c8072] shadow-sm">
            {message}
        </div>
    )
}

function ApplicantDetails({
    applicant,
    onClose,
}: {
    applicant: Applicant
    onClose: () => void
}) {
    return (
        <aside className="max-h-[85vh] w-full shrink-0 overflow-y-auto rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm xl:sticky xl:top-6 xl:w-[380px]">
            <DetailsHeader
                title={`${applicant.first_name} ${applicant.last_name}`}
                subtitle={`${applicant.email} · ${applicant.phone_number}`}
                extra={applicant.preferred_name ? `(${applicant.preferred_name})` : undefined}
                onClose={onClose}
            />

            <dl className="flex flex-col gap-4">
                {Object.entries(responseLabels).map(([key, label]) => {
                    const value = applicant.responses?.[key]
                    const display = Array.isArray(value) ? value.join(', ') : value || '—'

                    return (
                        <div key={key}>
                            <dt className="text-sm font-medium text-[#7c8072]">{label}</dt>
                            <dd className="whitespace-pre-wrap text-[#2c2c2c]">
                                {String(display)}
                            </dd>
                        </div>
                    )
                })}
            </dl>
        </aside>
    )
}

function GeneralInterestDetails({
    interest,
    onClose,
}: {
    interest: GeneralInterest
    onClose: () => void
}) {
    const friendEmails = interest.friend_emails ?? []

    return (
        <aside className="max-h-[85vh] w-full shrink-0 overflow-y-auto rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm xl:sticky xl:top-6 xl:w-[380px]">
            <DetailsHeader
                title={`${interest.first_name} ${interest.last_name}`}
                subtitle={`${interest.email} · ${interest.phone_number}`}
                onClose={onClose}
            />

            <dl className="flex flex-col gap-4">
                <div>
                    <dt className="text-sm font-medium text-[#7c8072]">Joined</dt>
                    <dd className="text-[#2c2c2c]">{formatDate(interest.created_at)}</dd>
                </div>
                <div>
                    <dt className="text-sm font-medium text-[#7c8072]">Pain Points</dt>
                    <dd className="whitespace-pre-wrap text-[#2c2c2c]">
                        {interest.pain_points}
                    </dd>
                </div>
                <div>
                    <dt className="text-sm font-medium text-[#7c8072]">Friend Emails</dt>
                    <dd className="text-[#2c2c2c]">
                        {friendEmails.length > 0 ? friendEmails.join(', ') : '—'}
                    </dd>
                </div>
            </dl>
        </aside>
    )
}

function DetailsHeader({
    title,
    subtitle,
    extra,
    onClose,
}: {
    title: string
    subtitle: string
    extra?: string
    onClose: () => void
}) {
    return (
        <div className="mb-4 flex items-start justify-between gap-3">
            <div>
                <h2 className="text-lg font-semibold text-[#2c2c2c]">
                    {title}
                    {extra && (
                        <span className="ml-1 font-normal text-[#7c8072]">{extra}</span>
                    )}
                </h2>
                <p className="break-words text-sm text-[#7c8072]">{subtitle}</p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="rounded-lg px-2 py-1 text-[#7c8072] hover:bg-[#f2ede0]"
            >
                ×
            </button>
        </div>
    )
}
