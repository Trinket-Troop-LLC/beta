-- public.applicants was set up directly in the Supabase dashboard, before
-- the migrations-only rule existed (same as public.users, see
-- 20260805000000_document_existing_users_table.sql). Three of its policies
-- predate migrations entirely and were never documented until now:
--   - "Anyone can submit an application" -- an anon-only insert policy that
--     predates "Anyone can submit a beta application" (added for anon AND
--     authenticated in 20260802000000_allow_authenticated_applicants_insert.sql).
--     Both still exist side by side live.
--   - "Admin can view applicants" / "Admin can update applicants" -- what
--     the admin dashboard (app/admin/) relies on to review and approve
--     applications.
-- Confirmed intentional. This documents the RLS policies only, not the full
-- table shape -- that audit is still open. Idempotent: safe to run against
-- the existing production table.

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'applicants'
          and policyname = 'Anyone can submit an application'
    ) then
        execute $policy$
            create policy "Anyone can submit an application"
                on public.applicants
                for insert
                to anon
                with check (true)
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'applicants'
          and policyname = 'Admin can view applicants'
    ) then
        execute $policy$
            create policy "Admin can view applicants"
                on public.applicants
                for select
                to authenticated
                using (
                    exists (
                        select 1
                        from public.users
                        where users.id = auth.uid()
                          and users.role = 'admin'
                    )
                )
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'applicants'
          and policyname = 'Admin can update applicants'
    ) then
        execute $policy$
            create policy "Admin can update applicants"
                on public.applicants
                for update
                to authenticated
                using (
                    exists (
                        select 1
                        from public.users
                        where users.id = auth.uid()
                          and users.role = 'admin'
                    )
                )
                with check (
                    exists (
                        select 1
                        from public.users
                        where users.id = auth.uid()
                          and users.role = 'admin'
                    )
                )
        $policy$;
    end if;
end;
$$;
