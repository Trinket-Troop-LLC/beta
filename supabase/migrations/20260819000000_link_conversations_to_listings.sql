-- Links conversations to the listing they're about, so a buyer's offer can
-- reserve that specific listing and so multiple pending offers on the same
-- listing can be told apart. Previously `origin_id` was a bare untyped uuid
-- with no FK, so nothing enforced or even recorded which listing an 'offer'
-- conversation was about.
alter table conversations
    add column listing_id uuid references listings(id) on delete set null,
    add column offered_listing_id uuid references listings(id) on delete set null;

-- Every 'offer' conversation must reference the listing it's about.
-- 'message_board' and 'direct' conversations aren't tied to a listing.
alter table conversations
    add constraint conversations_offer_requires_listing
    check (origin_type != 'offer' or listing_id is not null);

-- A buyer can optionally offer one of their own listings in trade, but it
-- can't be the same listing they're offering on.
alter table conversations
    add constraint conversations_offered_listing_distinct
    check (offered_listing_id is null or offered_listing_id != listing_id);

create index conversations_listing_id_idx on conversations(listing_id) where listing_id is not null;

-- Fixes a pre-existing bug: declineConversationRequest (app/(beta-app)/messages/actions.ts)
-- already calls db.from('conversations').delete() using the regular RLS-bound client, but no
-- DELETE policy has ever existed on this table, so declines have been silently no-opping (0
-- rows affected, no error surfaced). This also lets a seller auto-decline sibling pending
-- requests on the same listing when they accept one of them.
create policy "Participants can delete their pending conversations"
on conversations for delete
to authenticated
using (
    status = 'pending'
    and (auth.uid() = participant_one_id or auth.uid() = participant_two_id)
);
