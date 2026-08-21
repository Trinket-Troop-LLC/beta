begin;

-- "Nuance box" from the Listing View - Not Self Figma mock: a short,
-- optional flavor/detail note distinct from the main description --
-- e.g. quirks, condition specifics, or a personal note about the item.
alter table public.listings
    add column nuance text;

alter table public.listings
    add constraint listings_nuance_check
    check (
        nuance is null
        or (char_length(nuance) <= 500 and nuance ~ '[^[:space:]]')
    );

-- prepare_listing_write() must be replaced wholesale (not patched) --
-- this is the full existing body from 20260810000000_create_listings.sql
-- plus a conditional trim for nuance, matching other_category's pattern.
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
