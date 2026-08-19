-- chat-view.tsx subscribes to postgres_changes UPDATE events on `conversations`
-- (to redirect the other participant out when a trade is marked complete or
-- "didn't work out") but nothing ever added this table to the
-- supabase_realtime publication — that's a separate switch from RLS, and it
-- looks like `messages` only got it via a direct dashboard toggle at some
-- point (no prior migration does this for any table). Documenting it here so
-- it isn't another undocumented dashboard-only config, per this repo's rule
-- that schema-adjacent changes belong in a migration file.
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'conversations'
    ) then
        alter publication supabase_realtime add table public.conversations;
    end if;
end;
$$;
