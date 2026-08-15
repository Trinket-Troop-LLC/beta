begin;

-- Sell/gift listing requests now start a conversation tagged 'listing' (rather
-- than reusing 'offer' or 'message_board') so acceptConversationRequest can
-- tell a listing request apart from a bulletin reply and reserve the right
-- listing. 'offer' and 'direct' are unchanged -- still reserved for the
-- trade-acceptance and direct-message flows respectively.
alter table conversations
    drop constraint if exists conversations_origin_type_check;

alter table conversations
    add constraint conversations_origin_type_check
    check (origin_type in ('offer', 'message_board', 'direct', 'listing'));

-- A trade offer: someone proposes one of their own active listings in
-- exchange for someone else's. listing_id is the target (the owner's item),
-- offered_listing_id is what the offerer is putting up.
create table public.listing_offers (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings (id) on delete cascade,
    offered_listing_id uuid not null references public.listings (id) on delete cascade,
    offerer_id uuid not null references public.users (id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint listing_offers_distinct_listings_check
        check (listing_id <> offered_listing_id)
);

-- One pending offer per (listing, offerer) at a time -- resubmitting while
-- already pending would just create noise for the owner to sort through.
create unique index if not exists listing_offers_unique_pending
    on public.listing_offers (listing_id, offerer_id)
    where status = 'pending';

create index if not exists listing_offers_listing_id_idx
    on public.listing_offers (listing_id);

create index if not exists listing_offers_offerer_id_idx
    on public.listing_offers (offerer_id);

alter table public.listing_offers enable row level security;

-- Same lockdown shape as public.listings itself (see
-- 20260810010000_enable_listing_posting.sql): offers are read-only for
-- authenticated browser clients. Submitting, accepting, and declining an
-- offer all touch listings' status too (accepting auto-declines the rest and
-- reserves both sides), so those stay server-action-only, using the
-- service-role key, to keep that multi-row logic in one place instead of
-- duplicating it in RLS.
revoke all on table public.listing_offers from public, anon, authenticated;
grant select on table public.listing_offers to authenticated;
grant select, insert, update, delete on table public.listing_offers to service_role;

create policy "Members view offers they sent or received"
    on public.listing_offers
    for select
    to authenticated
    using (
        offerer_id = (select auth.uid())
        or exists (
            select 1
            from public.listings
            where listings.id = listing_offers.listing_id
              and listings.owner_id = (select auth.uid())
        )
    );

commit;
