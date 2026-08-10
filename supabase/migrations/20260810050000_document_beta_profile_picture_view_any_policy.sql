-- storage.objects gained a fourth policy on the beta-profile-pictures bucket
-- directly in the dashboard, alongside the three created in
-- 20260731020000_create_beta_profile_picture_storage.sql: any authenticated
-- user can view any object in the bucket, not just their own upload or an
-- admin generating a signed URL. Confirmed intentional. Documents the
-- current live shape so a fresh bootstrap matches production. Idempotent:
-- safe to run against the existing production database.

drop policy if exists
    "Authenticated users can view any beta profile picture"
    on storage.objects;

create policy "Authenticated users can view any beta profile picture"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'beta-profile-pictures'
    );
