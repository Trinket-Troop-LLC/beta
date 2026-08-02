grant insert on table public.applicants to anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'applicants'
          and policyname = 'Anyone can submit a beta application'
    ) then
        execute $policy$
            create policy "Anyone can submit a beta application"
                on public.applicants
                for insert
                to anon, authenticated
                with check (true)
        $policy$;
    end if;
end;
$$;
