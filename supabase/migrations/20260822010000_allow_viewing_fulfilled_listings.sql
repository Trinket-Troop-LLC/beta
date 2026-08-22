begin;

-- A completed sell/trade/gift/lend is meant to stay visible on the owner's
-- (and, for a trade, the other party's) profile with a "sold!"/"traded!"/etc
-- sticker -- see ListingStatusSticker and the profile pages in
-- app/(beta-app)/profile/. The original select policy only allowed a
-- non-owner to see 'active'/'reserved' listings, so a 'fulfilled' listing
-- silently vanished from a *viewer's* perspective the moment it completed
-- (the owner could still see their own via the owner_id branch, but the
-- trade partner's profile showed nothing for their side). Add 'fulfilled' to
-- the visible-to-others statuses; 'draft'/'archived' remain owner-only.

drop policy if exists "Members view available listings or their own" on public.listings;

create policy "Members view available listings or their own"
    on public.listings
    for select
    to authenticated
    using (
        owner_id = (select auth.uid())
        or (
            status = any (array['active', 'reserved', 'fulfilled'])
            and exists (
                select 1
                from public.users
                where users.id = (select auth.uid())
            )
        )
    );

commit;
