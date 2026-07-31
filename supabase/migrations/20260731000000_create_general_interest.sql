create table if not exists public.general_interest (
    id uuid primary key default gen_random_uuid(),
    first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
    last_name text not null check (char_length(btrim(last_name)) between 1 and 100),
    email text not null check (char_length(btrim(email)) between 3 and 320),
    phone_number text not null check (char_length(btrim(phone_number)) between 1 and 50),
    pain_points text not null check (char_length(btrim(pain_points)) between 1 and 3000),
    friend_emails text[] not null default '{}'
        check (
            cardinality(friend_emails) <= 20
            and char_length(array_to_string(friend_emails, ',')) <= 2000
        ),
    created_at timestamptz not null default now()
);

create unique index if not exists general_interest_email_lower_idx
    on public.general_interest (lower(email));

alter table public.general_interest enable row level security;

revoke all on table public.general_interest from public, anon, authenticated;
grant insert on table public.general_interest to anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'general_interest'
          and policyname = 'Anyone can join the general interest waiting list'
    ) then
        execute $policy$
            create policy "Anyone can join the general interest waiting list"
                on public.general_interest
                for insert
                to anon, authenticated
                with check (true)
        $policy$;
    end if;
end;
$$;
