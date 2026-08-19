'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function BulletinViewSwitcher({
    view,
    onChange,
}: {
    view: 'global' | 'troop'
    onChange: (view: 'global' | 'troop') => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)

    return (
        <div className="relative mb-4 inline-block">
            <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-1 text-xl font-semibold text-[#30392d]"
            >
                {view === 'global' ? 'Global' : 'My Troop'}
                <ChevronDown size={18} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
                <div className="absolute left-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-[#ded8cc] bg-[#fffdf9] shadow-sm">
                    <button
                        onClick={() => {
                            onChange('global')
                            setMenuOpen(false)
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-[#2c2c2c] hover:bg-[#f5efe5]"
                    >
                        Global
                    </button>
                    <button
                        onClick={() => {
                            onChange('troop')
                            setMenuOpen(false)
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-[#2c2c2c] hover:bg-[#f5efe5]"
                    >
                        My Troop
                    </button>
                </div>
            )}
        </div>
    )
}
