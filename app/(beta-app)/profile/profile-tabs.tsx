'use client'
import { useState } from 'react'

type AboutData = {
    email: string
    username: string
    responses: {
        neighborhood?: string
        emojis?: string
        categories?: string[]
    } | null
    created_at: string
}

const categoryLabels: Record<string, string> = {
    true: 'true trinkets',
    wearable: 'wearable trinkets',
    home: 'home trinkets',
    kitchen: 'kitchen trinkets',
    outdoorsy: 'outdoorsy trinkets',
    hobby: 'hobby trinkets',
    other: 'other trinkets',
}

export function SwitchProfileTab({ userId, aboutData }: { userId: string; aboutData: AboutData | null }) {
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
                <div className="flex flex-col gap-4 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <div>
                        <p className="text-sm font-medium text-[#7c8072]">Neighborhood</p>
                        <p className="text-[#2c2c2c]">{aboutData?.responses?.neighborhood || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-[#7c8072]">Emojis</p>
                        <p className="text-[#2c2c2c]">{aboutData?.responses?.emojis || '—'}</p>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-[#7c8072]">Trading categories</p>
                        <p className="text-[#2c2c2c]">
                            {aboutData?.responses?.categories?.length
                                ? aboutData.responses.categories
                                      .map((category) => categoryLabels[category] ?? category)
                                      .join(', ')
                                : '—'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-6 text-left shadow-sm">
                    <p className="text-sm text-[#625f58]">No listings yet.</p>
                </div>
            )}
        </div>
    )
}