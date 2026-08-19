-- chat-view.tsx will subscribe to postgres_changes UPDATEs on `listings` so
-- the non-owner participant finds out live when the owner marks a trade
-- complete or says it didn't work out (today only the owner's own local
-- state updates -- the other side has no way to know until they refresh).
-- Same idempotent pattern as 20260815030000_enable_realtime_for_messages.sql.
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
