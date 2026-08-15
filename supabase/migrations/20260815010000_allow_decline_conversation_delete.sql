-- declineConversationRequest (app/(beta-app)/messages/actions.ts) deletes a
-- pending conversation request, but no RLS policy allowed deletes on
-- conversations, so the delete silently affected zero rows and declined
-- requests stuck around. Scoped to pending requests the recipient (not the
-- initiator) is resolving, matching the .eq('status', 'pending') /
-- .neq('initiated_by', ...) guards already used for accept.
create policy "Recipient can delete a pending conversation request"
on conversations for delete
to authenticated
using (
    status = 'pending'
    and initiated_by != auth.uid()
    and (auth.uid() = participant_one_id or auth.uid() = participant_two_id)
);
