-- ChatView (app/(beta-app)/messages/[id]/chat-view.tsx) is about to subscribe
-- to postgres_changes UPDATEs on public.conversations, to redirect whichever
-- participant didn't click "Mark complete" / "Item returned" into the review
-- flow live instead of only on their next page load. Same undocumented-
-- publication trap as 20260815030000_enable_realtime_for_messages.sql and
-- 20260820200000_enable_realtime_for_listings.sql -- captured as a
-- migration this time, with a guard that makes it safe to re-run.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'conversations'
    ) then
        alter publication supabase_realtime add table public.conversations;
    end if;
end $$;
