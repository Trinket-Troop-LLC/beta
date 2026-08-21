import "server-only";
import { createClient } from '@/lib/supabase/server'

// Two-step app-level join (no conversation_id -> participant filter
// available in a single messages query) -- same pattern the rest of this
// codebase uses instead of Postgres views/functions. Takes an already-
// verified user id (from the (beta-app) layout's single requireMember()
// call) instead of re-checking auth itself -- this is only ever called
// after that check has already happened.
export async function getUnreadMessageCount(userId: string): Promise<number> {
    const db = await createClient()

    const { data: conversations } = await db
        .from('conversations')
        .select('id')
        .or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`)
        .neq('status', 'closed')

    const conversationIds = conversations?.map((c) => c.id) ?? []
    if (conversationIds.length === 0) return 0

    const { count } = await db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .is('read_at', null)

    return count ?? 0
}
