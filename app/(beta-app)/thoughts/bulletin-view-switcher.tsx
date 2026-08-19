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
        <div className="relative inline-block">
            <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-1 text-xl font-semibold text-foreground"
            >
                {view === 'global' ? 'Global' : 'My Troop'}
                <ChevronDown size={18} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
                <div className="absolute left-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <button
                        onClick={() => {
                            onChange('global')
                            setMenuOpen(false)
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-secondary"
                    >
                        Global
                    </button>
                    <button
                        onClick={() => {
                            onChange('troop')
                            setMenuOpen(false)
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-secondary"
                    >
                        My Troop
                    </button>
                </div>
            )}
        </div>
    )
}
