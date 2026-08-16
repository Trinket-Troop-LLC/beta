-- "One active conversation per listing at a time" was previously only an
-- emergent property of listings.status transitions in application code,
-- which had already drifted out of sync in multiple places (unreserveListing
-- not closing the old conversation; acceptConversationRequest flipping a
-- conversation to 'active' before its reservation check had succeeded).
-- This adds a real backstop at the database level.
--
-- Before applying, check for existing violations left over from those bugs:
--   select origin_id, count(*) from conversations
--   where status = 'active' and origin_type in ('offer', 'listing')
--   group by origin_id having count(*) > 1;
-- If any rows come back, close the stale ones (status = 'closed') first, or
-- this index will fail to create.
--
-- Scoped to 'offer' and 'listing' origin types, since those are the two that
-- map to a real listing id. 'message_board' origin_id points to a bulletin
-- post, where multiple simultaneous active conversations from different
-- repliers are expected and fine.
create unique index conversations_one_active_per_listing
on conversations (origin_id)
where status = 'active' and origin_type in ('offer', 'listing');

-- Backstop for the same check-then-insert race in requestConversation: a
-- double-click/double-submit could otherwise create two pending requests for
-- the same requester + listing/post before the first is visible to the
-- second's existence check.
create unique index conversations_one_pending_per_requester_and_origin
on conversations (origin_type, origin_id, participant_one_id, participant_two_id)
where status = 'pending';
