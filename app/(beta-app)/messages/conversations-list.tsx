'use client'

import { ChatCard } from '@/components/messages/chat-card'

type ConversationSummary = {
    id: string
    status: 'pending' | 'active'
    initiatedByMe: boolean
    originType: string
    title: string | null
    otherUser: {
        id: string
        username: string
        profilePictureUrl: string | null
        lastActiveAt: string | null
    }
    lastMessagePreview: string | null
    lastMessageAt: string | null
    updatedAt: string
}

export function ConversationsList({ conversations }: { conversations: ConversationSummary[] }) {
    return (
        <div className="w-full max-w-md">
            <h1 className="mb-6 text-3xl font-semibold text-foreground">Messages</h1>

            {conversations.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                    <p className="text-sm text-muted-foreground">No conversations yet.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {conversations.map((c) => (
                        <ChatCard
                            key={c.id}
                            href={`/messages/${c.id}`}
                            username={c.otherUser.username}
                            profilePictureUrl={c.otherUser.profilePictureUrl}
                            lastActiveAt={c.otherUser.lastActiveAt}
                            isActive={c.status === 'active'}
                            isPending={c.status === 'pending' && c.initiatedByMe}
                            originType={c.originType}
                            title={c.title}
                            lastMessagePreview={c.lastMessagePreview}
                            lastMessageAt={c.lastMessageAt}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
