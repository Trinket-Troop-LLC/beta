begin;

-- Photos are now optional at posting time and editable afterward (see
-- posts/actions.ts and app/(beta-app)/posts/edit-actions.ts), including
-- adding photos to a listing that's already published -- the previous
-- policy only allowed uploading while the linked listing was still
-- 'draft'. owner_id already scopes this to the caller, and the referenced
-- listing_photos row only exists because a trusted server action (running
-- as service_role) reserved it first, so the draft-only status check
-- wasn't adding real protection.
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
        )
    );

commit;
