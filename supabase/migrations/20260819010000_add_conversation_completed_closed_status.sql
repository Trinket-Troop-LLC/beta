-- Adds the two terminal states for a trade conversation: 'completed' (mark as
-- complete) and 'closed' ("didn't work out"). No RLS change needed — the
-- existing "Participants can update conversation status" policy
-- (20260810032957_create_conversations_and_messages.sql) already lets either
-- participant set status to any value; it was only ever the CHECK constraint
-- restricting the allowed values. The existing messages-insert policy already
-- requires status = 'active' (or pending+initiator) to send a message, so
-- 'completed'/'closed' automatically block new messages with no further change.
alter table conversations drop constraint if exists conversations_status_check;
alter table conversations
    add constraint conversations_status_check
    check (status in ('pending', 'active', 'completed', 'closed'));
