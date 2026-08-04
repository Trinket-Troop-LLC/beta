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

-- No INSERT policy exists, and no trigger on auth.users creates a row here either
-- (verified: the only triggers on this table are Postgres's automatic FK integrity
-- checks for applicant_id and id, nothing custom). Existing rows were created by hand
-- with the service-role key. The beta-app account-creation flow needs to do the same,
-- explicitly, as two steps: auth.admin.inviteUserByEmail(...) to create the auth user,
-- then a separate service-role insert into public.users (id, email, username,
-- role: 'user', applicant_id) — nothing does either of these automatically.

-- No SELECT policy exists for viewing another user's row. Any beta-app screen that shows
-- someone else's profile (a listing's owner, a chat participant) needs a new policy for
-- that — flagged, not yet resolved.
