-- Chat realtime (app/(beta-app)/messages/[id]/chat-view.tsx) subscribes to
-- postgres_changes INSERTs on public.messages, but that only fires if the
-- table is part of the supabase_realtime publication. That was previously
-- only ever toggled by hand in the dashboard (Database > Replication) --
-- never captured in a migration -- so it's an undocumented setting that can
-- silently get reset with no code change to explain it. Making it a
-- migration is the actual fix; the guard makes it safe to re-run.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;
end $$;
