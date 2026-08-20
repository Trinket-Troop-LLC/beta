-- ChatView (app/(beta-app)/messages/[id]/chat-view.tsx) is about to subscribe
-- to postgres_changes UPDATEs on public.listings, so the participant who
-- didn't click "Mark complete" sees the status flip live instead of needing
-- a refresh. Same undocumented-publication trap as
-- 20260815030000_enable_realtime_for_messages.sql -- captured as a migration
-- this time, with a guard that makes it safe to re-run.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'listings'
    ) then
        alter publication supabase_realtime add table public.listings;
    end if;
end $$;
