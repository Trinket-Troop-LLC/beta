'use client'
import { useState } from 'react'
import { StatusDropdown } from './status-dropdown'

const responseLabels: Record<string, string> = {
    neighborhood: "Neighborhood",
    emojis: "Emojis",
    what_trading: "Buy/Sell/Trade",
    categories: "Categories",
    other_category: "Other Category",
    pain_points: "Pain Points",
    future_features: "Features Wanted",
    referral_email: "Referral",
    misc_thoughts: "Thoughts",
}

type Applicant = {
    id: string
    first_name: string
    last_name: string
    preferred_name: string | null
    email: string
    phone_number: string
    status: string
    responses: Record<string, unknown>
}

export function AdminDashboardClient({ applicants }: { applicants: Applicant[] }) {
    const [selected, setSelected] = useState<Applicant | null>(null)

    const thClass = "px-4 py-3 border-b border-r border-[#ded8cc] text-center font-semibold text-[#2c2c2c] whitespace-nowrap last:border-r-0"
    const tdClass = "px-4 py-3 border-b border-r border-[#ded8cc] text-center text-[#2c2c2c] align-middle last:border-r-0"

    return (
        <div className="flex gap-6 items-start">
            {/* Table — shrinks when panel is open */}
            <div className={`overflow-x-auto rounded-2xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm transition-all ${selected ? 'flex-1 min-w-0' : 'w-full'}`}>
                <table className="min-w-full text-sm border-collapse">
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
                                className={`hover:bg-[#f7f3ea] transition ${selected?.id === applicant.id ? 'bg-[#f2ede0]' : ''}`}
                            >
                                <td className={tdClass}>{applicant.first_name}</td>
                                <td className={tdClass}>{applicant.last_name}</td>
                                <td className={tdClass}>{applicant.email}</td>
                                <td className={tdClass}>{applicant.phone_number}</td>
                                <td className={tdClass}>
                                    <button
                                        onClick={() => setSelected(applicant)}
                                        className="rounded-lg bg-[#7c9272] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#667b5f]"
                                    >
                                        View Responses
                                    </button>
                                </td>
                                <td className={tdClass}>
                                    <StatusDropdown applicantId={applicant.id} currentStatus={applicant.status} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Side panel — only rendered when something is selected */}
            {selected && (
                <div className="sticky top-6 w-[380px] shrink-0 max-h-[85vh] overflow-y-auto rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 shadow-sm">
                    <div className="mb-4 flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-[#2c2c2c]">
                                {selected.first_name} {selected.last_name}
                                {selected.preferred_name && (
                                    <span className="font-normal text-[#7c8072]"> ({selected.preferred_name})</span>
                                )}
                            </h2>
                            <p className="text-sm text-[#7c8072]">
                                {selected.email} · {selected.phone_number}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelected(null)}
                            className="rounded-lg px-2 py-1 text-[#7c8072] hover:bg-[#f2ede0]"
                        >
                            ✕
                        </button>
                    </div>

                    <dl className="flex flex-col gap-4">
                        {Object.entries(responseLabels).map(([key, label]) => {
                            const value = selected.responses?.[key]
                            const display = Array.isArray(value) ? value.join(', ') : (value || '—')
                            return (
                                <div key={key}>
                                    <dt className="text-sm font-medium text-[#7c8072]">{label}</dt>
                                    <dd className="text-[#2c2c2c]">{String(display)}</dd>
                                </div>
                            )
                        })}
                    </dl>
                </div>
            )}
        </div>
    )
}