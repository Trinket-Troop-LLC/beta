begin;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'beta-profile-pictures',
    'beta-profile-pictures',
    false,
    3145728,
    array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists
    "Anyone can upload beta profile pictures"
    on storage.objects;

create policy "Anyone can upload beta profile pictures"
    on storage.objects
    for insert
    to anon, authenticated
    with check (
        bucket_id = 'beta-profile-pictures'
        and name ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    );

drop policy if exists
    "Uploaders can receive beta profile picture metadata"
    on storage.objects;

create policy "Uploaders can receive beta profile picture metadata"
    on storage.objects
    for select
    to anon, authenticated
    using (
        bucket_id = 'beta-profile-pictures'
        and name ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        and storage.allow_only_operation('storage.object.upload')
    );

drop policy if exists
    "Admins can sign beta profile pictures"
    on storage.objects;

create policy "Admins can sign beta profile pictures"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'beta-profile-pictures'
        and name ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        and storage.allow_any_operation(
            array[
                'storage.object.sign',
                'storage.object.sign_many'
            ]
        )
        and exists (
            select 1
            from public.users
            where users.id = (select auth.uid())
              and users.role = 'admin'
        )
    );

commit;
