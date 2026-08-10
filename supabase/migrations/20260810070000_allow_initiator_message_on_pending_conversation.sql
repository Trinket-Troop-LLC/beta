-- The original messages insert policy only allowed sending into an 'active'
-- conversation, which made it impossible to ever store the first message on
-- a 'pending' conversation request (see requestConversation in
-- app/(beta-app)/messages/actions.ts). Intent: the recipient should see the
-- initiator's opening message alongside the Accept/Decline prompt, so the
-- initiator needs to be able to insert into their own pending conversation.
-- The recipient still can't send anything until they accept — the chat UI
-- hides the input box until status is 'active', and this policy only grants
-- the exception to the conversation's initiator.
drop policy "Participants can send messages in active conversations" on messages;

create policy "Participants can send messages in active or own-pending conversations"
on messages for insert
to authenticated
with check (
    sender_id = auth.uid()
    and exists (
        select 1 from conversations
        where conversations.id = messages.conversation_id
        and (
            conversations.status = 'active'
            or (conversations.status = 'pending' and conversations.initiated_by = auth.uid())
        )
        and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())
    )
);
