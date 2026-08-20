-- markMessagesRead (app/(beta-app)/messages/actions.ts) sets read_at on
-- messages in a conversation once the recipient opens it, but no update
-- policy existed on `messages` at all -- the update silently affected 0 rows
-- under RLS. Scoped the same way the "view messages" select policy already
-- is: any participant in the conversation, same as every other messages
-- policy in this table.
create policy "Participants can mark messages read in their conversations"
on messages for update
to authenticated
using (
    exists (
        select 1 from conversations
        where conversations.id = messages.conversation_id
        and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())
    )
)
with check (
    exists (
        select 1 from conversations
        where conversations.id = messages.conversation_id
        and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())
    )
);
