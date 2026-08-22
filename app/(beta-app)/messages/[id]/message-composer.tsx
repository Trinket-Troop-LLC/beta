'use client'

import { Send } from 'lucide-react'

export function MessageComposer({
    draft,
    setDraft,
    isSending,
    onSend,
}: {
    draft: string
    setDraft: (value: string) => void
    isSending: boolean
    onSend: () => void
}) {
    return (
        <div className="flex justify-center px-8 py-3">
            <div className="flex w-full max-w-xs items-center gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSend()
                    }}
                    placeholder="trinkets..."
                    className="flex-1 rounded-full border border-input bg-card px-4 py-1.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                    onClick={onSend}
                    disabled={isSending || !draft.trim()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Send size={15} />
                </button>
            </div>
        </div>
    )
}
