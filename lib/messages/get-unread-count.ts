import "server-only";
import { createClient } from '@/lib/supabase/server'

// Two-step app-level join (no conversation_id -> participant filter
// available in a single messages query) -- same pattern the rest of this
// codebase uses instead of Postgres views/functions.
export async function getUnreadMessageCount(): Promise<number> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return 0

    const { data: conversations } = await db
        .from('conversations')
        .select('id')
        .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
        .neq('status', 'closed')

    const conversationIds = conversations?.map((c) => c.id) ?? []
    if (conversationIds.length === 0) return 0

    const { count } = await db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .is('read_at', null)

    return count ?? 0
}
