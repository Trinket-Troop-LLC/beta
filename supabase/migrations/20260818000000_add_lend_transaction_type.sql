begin;

-- Lending joins sell/trade/gift as a fourth transaction type. It's
-- request-based like gift (reuses the origin_type = 'listing' request/accept
-- flow), but its reservation isn't terminal -- the owner chooses to relist
-- or take the item down once it's returned, instead of always landing on
-- 'fulfilled'. See markListingReturned in
-- app/(beta-app)/troop/listing-lifecycle-actions.ts.

alter table public.listings
    drop constraint if exists listings_transaction_types_check;

alter table public.listings
    add constraint listings_transaction_types_check
    check (
        cardinality(transaction_types) between 1 and 4
        and transaction_types <@ array['sell', 'trade', 'gift', 'lend']::text[]
        and array_position(transaction_types, null) is null
        and cardinality(array_positions(transaction_types, 'sell')) <= 1
        and cardinality(array_positions(transaction_types, 'trade')) <= 1
        and cardinality(array_positions(transaction_types, 'gift')) <= 1
        and cardinality(array_positions(transaction_types, 'lend')) <= 1
    );

-- Tracks which of a listing's selected transaction_types the current
-- reservation actually is, since a listing can offer several at once (e.g.
-- sell + trade + lend) but only one can be in play while it's reserved.
-- Stamped the moment a listing reserves (acceptConversationRequest for
-- sell/gift/lend requests, acceptListingOffer for trades) and cleared
-- whenever it leaves 'reserved' (markListingFulfilled, unreserveListing,
-- markListingReturned), so it never lingers stale onto a later, unrelated
-- reservation. One-directional on purpose: a reserved listing is allowed to
-- have a null active_transaction_type (e.g. a request accepted before this
-- column existed), which just falls back to the original
-- fulfilled-or-didn't-work-out behavior rather than the lend-specific
-- return flow.
alter table public.listings
    add column active_transaction_type text;

alter table public.listings
    add constraint listings_active_transaction_type_check
    check (
        active_transaction_type is null
        or (
            status = 'reserved'
            and active_transaction_type = any (array['sell', 'trade', 'gift', 'lend'])
        )
    );

-- Carries the requester's chosen type (sell/gift/lend) from a pending
-- listing request through to acceptance, so acceptConversationRequest knows
-- what to stamp onto listings.active_transaction_type. Null for every other
-- origin_type -- trade offers carry their type via listing_offers instead
-- (acceptListingOffer sets active_transaction_type = 'trade' directly), and
-- message_board/direct conversations have no transaction type at all.
alter table public.conversations
    add column transaction_type text;

alter table public.conversations
    add constraint conversations_transaction_type_check
    check (
        transaction_type is null
        or transaction_type = any (array['sell', 'trade', 'gift', 'lend'])
    );

commit;
