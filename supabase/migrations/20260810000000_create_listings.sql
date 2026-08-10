begin;

create table public.listings (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.users (id) on delete cascade,
    title text not null,
    description text not null,
    category text not null,
    other_category text,
    condition text not null,
    transaction_types text[] not null,
    price_cents integer,
    pickup_area text not null,
    status text not null default 'draft',
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint listings_title_check
        check (char_length(title) <= 120 and title ~ '[^[:space:]]'),
    constraint listings_description_check
        check (char_length(description) <= 3000 and description ~ '[^[:space:]]'),
    constraint listings_category_check
        check (
            category = any (
                array['true', 'wearable', 'home', 'kitchen', 'outdoorsy', 'hobby', 'other']
            )
        ),
    constraint listings_other_category_check
        check (
            (
                category = 'other'
                and other_category is not null
                and char_length(other_category) <= 100
                and other_category ~ '[^[:space:]]'
            )
            or (category <> 'other' and other_category is null)
        ),
    constraint listings_condition_check
        check (
            condition = any (array['new', 'like_new', 'good', 'fair', 'well_loved'])
        ),
    constraint listings_transaction_types_check
        check (
            cardinality(transaction_types) between 1 and 3
            and transaction_types <@ array['sell', 'trade', 'gift']::text[]
            and array_position(transaction_types, null) is null
            and cardinality(array_positions(transaction_types, 'sell')) <= 1
            and cardinality(array_positions(transaction_types, 'trade')) <= 1
            and cardinality(array_positions(transaction_types, 'gift')) <= 1
        ),
    constraint listings_price_check
        check (
            case
                when 'sell' = any (transaction_types)
                    then price_cents is not null and price_cents > 0
                else price_cents is null
            end
        ),
    constraint listings_pickup_area_check
        check (char_length(pickup_area) <= 150 and pickup_area ~ '[^[:space:]]'),
    constraint listings_status_check
        check (
            status = any (array['draft', 'active', 'reserved', 'fulfilled', 'archived'])
        ),
    constraint listings_published_at_check
        check (
            (status = 'draft' and published_at is null)
            or (status = any (array['active', 'reserved', 'fulfilled']) and published_at is not null)
            or status = 'archived'
        )
);

create index if not exists listings_owner_created_at_idx
    on public.listings (owner_id, created_at desc);

create index if not exists listings_active_published_at_idx
    on public.listings (published_at desc)
    where status = 'active';

create index if not exists listings_active_category_published_at_idx
    on public.listings (category, published_at desc)
    where status = 'active';

create index if not exists listings_transaction_types_gin_idx
    on public.listings using gin (transaction_types);

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

revoke all on function public.prepare_listing_write() from public;

drop trigger if exists prepare_listing_write on public.listings;

create trigger prepare_listing_write
    before insert or update on public.listings
    for each row
    execute function public.prepare_listing_write();

alter table public.listings enable row level security;

-- Define the member/owner access boundary now, but keep the table grants
-- disabled until the posting and photo flow is ready. RLS policies alone do
-- not grant access; a later migration must explicitly grant the required
-- operations to authenticated users.
revoke all on table public.listings from public, anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'listings'
          and policyname = 'Members view available listings or their own'
    ) then
        execute $policy$
            create policy "Members view available listings or their own"
                on public.listings
                for select
                to authenticated
                using (
                    owner_id = (select auth.uid())
                    or (
                        status = any (array['active', 'reserved'])
                        and exists (
                            select 1
                            from public.users
                            where users.id = (select auth.uid())
                        )
                    )
                )
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'listings'
          and policyname = 'Members can create their own draft listings'
    ) then
        execute $policy$
            create policy "Members can create their own draft listings"
                on public.listings
                for insert
                to authenticated
                with check (
                    owner_id = (select auth.uid())
                    and status = 'draft'
                    and published_at is null
                    and exists (
                        select 1
                        from public.users
                        where users.id = (select auth.uid())
                    )
                )
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'listings'
          and policyname = 'Owners can update their own listings'
    ) then
        execute $policy$
            create policy "Owners can update their own listings"
                on public.listings
                for update
                to authenticated
                using (
                    owner_id = (select auth.uid())
                    and exists (
                        select 1
                        from public.users
                        where users.id = (select auth.uid())
                    )
                )
                with check (
                    owner_id = (select auth.uid())
                    and exists (
                        select 1
                        from public.users
                        where users.id = (select auth.uid())
                    )
                )
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'listings'
          and policyname = 'Owners can delete their own draft listings'
    ) then
        execute $policy$
            create policy "Owners can delete their own draft listings"
                on public.listings
                for delete
                to authenticated
                using (
                    owner_id = (select auth.uid())
                    and status = 'draft'
                    and exists (
                        select 1
                        from public.users
                        where users.id = (select auth.uid())
                    )
                )
        $policy$;
    end if;
end;
$$;

commit;
