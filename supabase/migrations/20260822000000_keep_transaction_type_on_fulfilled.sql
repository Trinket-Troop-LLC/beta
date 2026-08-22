begin;

-- markListingFulfilled (app/(beta-app)/troop/listing-lifecycle-actions.ts) now
-- deliberately keeps active_transaction_type set when a listing transitions
-- reserved -> fulfilled, so the profile "trinkets" grid can show which kind
-- of exchange completed it (sold!/traded!/gifted!/lent!) instead of the
-- listing just disappearing. The original constraint (added in
-- 20260818000000_add_lend_transaction_type.sql) only allowed a non-null
-- active_transaction_type while status = 'reserved', which made that update
-- fail outright. Widen it to also allow 'fulfilled'. unreserveListing and
-- markListingReturned still null the column out themselves for the
-- genuinely-didn't-complete cases, so this doesn't change that behavior.

alter table public.listings
    drop constraint if exists listings_active_transaction_type_check;

alter table public.listings
    add constraint listings_active_transaction_type_check
    check (
        active_transaction_type is null
        or (
            status in ('reserved', 'fulfilled')
            and active_transaction_type = any (array['sell', 'trade', 'gift', 'lend'])
        )
    );

commit;
