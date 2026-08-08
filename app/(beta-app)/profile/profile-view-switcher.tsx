// app/profile/profile-view-switcher.tsx
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function ProfileViewSwitcher({
    profileView,
    troopView,
}: {
    profileView: React.ReactNode
    troopView: React.ReactNode
}) {
    const [view, setView] = useState<'profile' | 'troop'>('profile')
    const [menuOpen, setMenuOpen] = useState(false)

    return (
        <div>
            <div className="relative mb-4 inline-block">
                <button
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-1 text-2xl font-semibold text-[#30392d]"
                >
                    {view === 'profile' ? 'My Profile' : 'My Troop'}
                    <ChevronDown size={20} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                    <div className="absolute left-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm">
                        <button
                            onClick={() => {
                                setView('profile')
                                setMenuOpen(false)
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-[#2c2c2c] hover:bg-[#f5efe5]"
                        >
                            My Profile
                        </button>
                        <button
                            onClick={() => {
                                setView('troop')
                                setMenuOpen(false)
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-[#2c2c2c] hover:bg-[#f5efe5]"
                        >
                            My Troop
                        </button>
                    </div>
                )}
            </div>

            {view === 'profile' ? profileView : troopView}
        </div>
    )
}