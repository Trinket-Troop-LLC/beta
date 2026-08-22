// app/profile/profile-view-switcher.tsx
'use client'

import { useState } from 'react'

export function ProfileViewSwitcher({
    profileView,
    troopView,
}: {
    profileView: React.ReactNode
    troopView: React.ReactNode
}) {
    const [view, setView] = useState<'profile' | 'troop'>('profile')

    return (
        <div>
            <div className="mb-6 flex">
                <button
                    onClick={() => setView('profile')}
                    aria-pressed={view === 'profile'}
                    className={`flex-1 border-b-2 pb-2 text-center text-lg font-medium transition ${
                        view === 'profile'
                            ? 'border-foreground text-foreground'
                            : 'border-secondary text-muted-foreground'
                    }`}
                >
                    me
                </button>
                <button
                    onClick={() => setView('troop')}
                    aria-pressed={view === 'troop'}
                    className={`flex-1 border-b-2 pb-2 text-center text-lg font-medium transition ${
                        view === 'troop'
                            ? 'border-foreground text-foreground'
                            : 'border-secondary text-muted-foreground'
                    }`}
                >
                    my troop
                </button>
            </div>

            {view === 'profile' ? profileView : troopView}
        </div>
    )
}
