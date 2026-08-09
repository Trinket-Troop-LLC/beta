-- The "My Troop" friend-request feature added public.friendships directly in
-- the dashboard, no migration. Documents its actual current shape (verified
-- against information_schema, pg_constraint, and pg_policies) so it's not a
-- third undocumented table alongside applicants and users. Idempotent: safe
-- to run against the existing production table.
--
-- Note: the (requester_id, addressee_id) unique constraint only prevents a
-- duplicate in that exact order — it does not by itself stop B from
-- requesting A after A already requested B. The app layer (friendship-actions.ts)
-- checks both directions before inserting; the constraint alone doesn't
-- enforce that, worth keeping in mind if anything else ever writes to this
-- table directly.

create table if not exists public.friendships (
    id uuid primary key default gen_random_uuid(),
    requester_id uuid not null references public.users (id) on delete cascade,
    addressee_id uuid not null references public.users (id) on delete cascade,
    status text not null default 'pending' check (status = any (array['pending', 'accepted'])),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    check (requester_id <> addressee_id),
    unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'friendships'
          and policyname = 'Users can view their own friendships'
    ) then
        execute $policy$
            create policy "Users can view their own friendships"
                on public.friendships
                for select
                to authenticated
                using (auth.uid() = requester_id or auth.uid() = addressee_id)
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'friendships'
          and policyname = 'Users can send friend requests'
    ) then
        execute $policy$
            create policy "Users can send friend requests"
                on public.friendships
                for insert
                to authenticated
                with check (auth.uid() = requester_id)
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'friendships'
          and policyname = 'Users can update friendships they are part of'
    ) then
        execute $policy$
            create policy "Users can update friendships they are part of"
                on public.friendships
                for update
                to authenticated
                using (auth.uid() = addressee_id or auth.uid() = requester_id)
                with check (auth.uid() = addressee_id or auth.uid() = requester_id)
        $policy$;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'friendships'
          and policyname = 'Either party can delete a friendship'
    ) then
        execute $policy$
            create policy "Either party can delete a friendship"
                on public.friendships
                for delete
                to authenticated
                using (auth.uid() = requester_id or auth.uid() = addressee_id)
        $policy$;
    end if;
end;
$$;
