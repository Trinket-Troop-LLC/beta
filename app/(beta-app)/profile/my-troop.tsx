// app/profile/my-troop.tsx
'use client'

import { useState } from 'react'

export function MyTroop({ userId }: { userId: string }) {
    const [tab, setTab] = useState<'friends' | 'requests'>('friends')
    const [search, setSearch] = useState('')

    return (
        <div>
            <div className="mb-4 flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
                    onClick={() => setTab('friends')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'friends' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Friends
                </button>
                <button
                    onClick={() => setTab('requests')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        tab === 'requests' ? 'bg-[#7c9272] text-white' : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Requests
                </button>
            </div>

            {tab === 'friends' && (
                <div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by username"
                        className="mb-4 w-full rounded-lg border border-[#d8d1c5] bg-white px-4 py-3 text-black outline-none transition focus:border-[#7c9272] focus:ring-2 focus:ring-[#7c9272]/20"
                    />

                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="text-sm text-[#625f58]">
                            {search ? 'Search results coming soon.' : 'No troop members yet.'}
                        </p>
                    </div>
                </div>
            )}

            {tab === 'requests' && (
                <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="mb-2 text-sm font-medium text-[#7c8072]">Requests received</p>
                        <p className="text-sm text-[#625f58]">Nothing yet.</p>
                    </div>

                    <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                        <p className="mb-2 text-sm font-medium text-[#7c8072]">Requests sent</p>
                        <p className="text-sm text-[#625f58]">Nothing yet.</p>
                    </div>
                </div>
            )}
        </div>
    )
}