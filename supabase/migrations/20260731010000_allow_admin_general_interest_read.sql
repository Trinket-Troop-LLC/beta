grant select on table public.general_interest to authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'general_interest'
          and policyname = 'Admins can view the general interest waiting list'
    ) then
        execute $policy$
            create policy "Admins can view the general interest waiting list"
                on public.general_interest
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
