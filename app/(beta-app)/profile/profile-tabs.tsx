'use client'
import { useState } from 'react'

export function SwitchProfileTab({ userId }: { userId: string }) {
    const [view, setView] = useState<'about' | 'listings'>('about')

    return (
        <div>
            <div className="mb-4 flex rounded-full border border-[#ded8cc] bg-[#fffdf9] p-1">
                <button
                    onClick={() => setView('about')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        view === 'about'
                            ? 'bg-[#7c9272] text-white'
                            : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    About
                </button>
                <button
                    onClick={() => setView('listings')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                        view === 'listings'
                            ? 'bg-[#7c9272] text-white'
                            : 'text-[#625f58] hover:bg-[#f5efe5]'
                    }`}
                >
                    Listings
                </button>
            </div>

            {view === 'about' ? (
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <p className="text-sm text-[#625f58]">About content coming soon.</p>
                </div>
            ) : (
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <p className="text-sm text-[#625f58]">No listings yet.</p>
                </div>
            )}
        </div>
    )
}