-- Ownership is proven by the path itself (owner-uuid/photo-uuid.ext), not by a
-- join to bulletin_post_photos/bulletin_reply_photos, because those metadata
-- rows don't exist yet at upload time (thoughts/actions.ts links storage_path
-- to a post/reply only after the client has already uploaded) and are already
-- gone by delete time (post/reply deletion cascades the metadata row away
-- before actions.ts calls storage.remove()). Same shape as
-- beta-profile-pictures, not listing-photos.

begin;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'bulletin-photos',
    'bulletin-photos',
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

drop policy if exists "Members upload their own bulletin photos" on storage.objects;

create policy "Members upload their own bulletin photos"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'bulletin-photos'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "Authenticated users can view any bulletin photo" on storage.objects;

create policy "Authenticated users can view any bulletin photo"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'bulletin-photos'
    );

drop policy if exists "Members delete their own bulletin photos" on storage.objects;

create policy "Members delete their own bulletin photos"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'bulletin-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

commit;
