begin;

create table public.listing_photos (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings (id) on delete cascade,
    storage_path text not null unique,
    position smallint not null check (position between 0 and 4),
    created_at timestamptz not null default now(),
    check (
        storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    ),
    unique (listing_id, position)
);

alter table public.listing_photos enable row level security;

revoke all on table public.listing_photos from public, anon, authenticated;
grant select on table public.listing_photos to authenticated;

create policy "Members view permitted listing photos"
    on public.listing_photos
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.listings
            where listings.id = listing_photos.listing_id
              and (
                  listings.owner_id = (select auth.uid())
                  or (
                      listings.status = any (array['active', 'reserved'])
                      and exists (
                          select 1
                          from public.users
                          where users.id = (select auth.uid())
                      )
                  )
              )
        )
    );

-- Listing writes stay behind server actions that first authenticate with the
-- caller's cookie session and then use the project's server-only secret key.
-- Authenticated browser clients may read listings, but cannot create, mutate,
-- publish, or delete rows directly.
revoke insert, update, delete on table public.listings from authenticated;
grant select on table public.listings to authenticated;

drop policy if exists "Members can create their own draft listings" on public.listings;
drop policy if exists "Owners can update their own listings" on public.listings;
drop policy if exists "Owners can delete their own draft listings" on public.listings;

-- Make the secret-key client's table access explicit instead of relying on
-- Supabase's default service-role grants.
grant select, insert, update, delete on table public.listings to service_role;
grant select, insert, delete on table public.listing_photos to service_role;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'listing-photos',
    'listing-photos',
    false,
    5242880,
    array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload their listing photos" on storage.objects;

create policy "Members upload their listing photos"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'listing-photos'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and owner_id = (select auth.uid())::text
        and exists (
            select 1
            from public.listing_photos
            join public.listings
              on listings.id = listing_photos.listing_id
            where listing_photos.storage_path = storage.objects.name
              and listings.id::text = (storage.foldername(name))[2]
              and listings.owner_id = (select auth.uid())
              and listings.status = 'draft'
        )
    );

drop policy if exists "Members read permitted listing photos" on storage.objects;

create policy "Members read permitted listing photos"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'listing-photos'
        and (
            (
                exists (
                    select 1
                    from public.listing_photos
                    join public.listings
                      on listings.id = listing_photos.listing_id
                    where listing_photos.storage_path = storage.objects.name
                      and listings.owner_id = (select auth.uid())
                )
            )
            or (
                exists (
                    select 1
                    from public.users
                    where users.id = (select auth.uid())
                )
                and exists (
                    select 1
                    from public.listing_photos
                    join public.listings
                      on listings.id = listing_photos.listing_id
                    where listing_photos.storage_path = storage.objects.name
                      and listings.status = any (array['active', 'reserved'])
                )
            )
        )
    );

drop policy if exists "Owners delete their listing photos" on storage.objects;

commit;
