-- markListingFulfilled (app/(beta-app)/troop/listing-lifecycle-actions.ts)
-- closes out a conversation once its listing/trade is fulfilled, but the
-- original status check constraint only allowed ('pending', 'active') --
-- 'closed' was never a legal value, so that update always failed the
-- constraint (silently, since the caller doesn't check the error) and
-- finished conversations were left stuck as 'active'.
alter table conversations
    drop constraint if exists conversations_status_check;

alter table conversations
    add constraint conversations_status_check
    check (status in ('pending', 'active', 'closed'));
