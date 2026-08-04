-- public.users was created directly in the Supabase dashboard, outside migrations,
-- before this rule existed. This documents its actual current shape (verified against
-- information_schema, pg_constraint, and pg_policies) so it's no longer an undocumented
-- blind spot. Every clause is idempotent — safe to run against the existing production
-- table, and correct for bootstrapping a fresh environment from scratch.

create table if not exists public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    username text not null unique,
    role text not null default 'user' check (role = any (array['guest', 'user', 'admin'])),
    applicant_id uuid references public.applicants (id),
    responses jsonb,
    created_at timestamptz default now()
);

alter table public.users enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'users'
          and policyname = 'Users can view their own profile'
    ) then
        execute $policy$
            create policy "Users can view their own profile"
                on public.users
                for select
                to authenticated
                using (auth.uid() = id)
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
          and tablename = 'users'
          and policyname = 'Users can update their own profiles'
    ) then
        execute $policy$
            create policy "Users can update their own profiles"
                on public.users
                for update
                to authenticated
                using (auth.uid() = id)
                with check (auth.uid() = id and role = 'user')
        $policy$;
    end if;
end;
$$;

-- No INSERT policy exists. Rows are created via a privileged path only (a database
-- trigger on auth.users, or the service-role key directly) — not a client-side insert.
-- This is deliberate: the beta-app account-creation flow should use that same
-- privileged path, not add a client-facing insert policy.

-- No SELECT policy exists for viewing another user's row. Any beta-app screen that shows
-- someone else's profile (a listing's owner, a chat participant) needs a new policy for
-- that — flagged, not yet resolved.
