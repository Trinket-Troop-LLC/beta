-- The SELECT policy on public.users was changed directly in the dashboard:
-- "Users can view their own profile" (using auth.uid() = id, created in
-- 20260805000000_document_existing_users_table.sql) was dropped and replaced
-- with "Users can view any profile" (using true). This closes the gap that
-- migration's trailing comment flagged as unresolved -- other users' profiles
-- need to be visible for things like chat participants and troop listings.
-- Confirmed intentional. Documents the current live shape so a fresh
-- bootstrap matches production. Idempotent: safe to run against the existing
-- production table.

drop policy if exists "Users can view their own profile" on public.users;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'users'
          and policyname = 'Users can view any profile'
    ) then
        execute $policy$
            create policy "Users can view any profile"
                on public.users
                for select
                to authenticated
                using (true)
        $policy$;
    end if;
end;
$$;
