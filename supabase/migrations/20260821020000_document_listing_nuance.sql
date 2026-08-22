-- The nuance column, its check constraint, and the corresponding trim in
-- prepare_listing_write() were applied directly against this database via
-- the Supabase SQL editor (from beta-internal's
-- 20260821010000_add_listing_nuance.sql) rather than through this branch's
-- own migration history -- the SQL was meant for the internal project but
-- got run here instead. This documents that already-applied state so it's
-- not an undocumented blind spot. Every clause is idempotent -- safe to run
-- again against this table, and correct for bootstrapping a fresh
-- environment from scratch. The "Listing View - Not Self" feature this
-- column supports hasn't shipped to production's code yet; this just keeps
-- schema and migration history in sync with what's actually live.

begin;

alter table public.listings
    add column if not exists nuance text;

alter table public.listings
    drop constraint if exists listings_nuance_check;

alter table public.listings
    add constraint listings_nuance_check
    check (
        nuance is null
        or (char_length(nuance) <= 500 and nuance ~ '[^[:space:]]')
    );

create or replace function public.prepare_listing_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.title := btrim(new.title, E' \t\n\r\f' || chr(11));
    new.description := btrim(new.description, E' \t\n\r\f' || chr(11));
    new.pickup_area := btrim(new.pickup_area, E' \t\n\r\f' || chr(11));

    if new.other_category is not null then
        new.other_category := btrim(new.other_category, E' \t\n\r\f' || chr(11));
    end if;

    if new.nuance is not null then
        new.nuance := btrim(new.nuance, E' \t\n\r\f' || chr(11));
    end if;

    if tg_op = 'INSERT' then
        new.created_at := now();
        new.updated_at := new.created_at;
        new.published_at := case when new.status = 'active' then new.created_at else null end;
    else
        new.id := old.id;
        new.owner_id := old.owner_id;
        new.created_at := old.created_at;
        new.updated_at := now();

        if old.published_at is null and new.status = 'active' then
            new.published_at := new.updated_at;
        else
            new.published_at := old.published_at;
        end if;
    end if;

    return new;
end;
$$;

commit;
