begin;

alter table public.listings
    add column if not exists ideal_trade_description text;

alter table public.listings
    drop constraint if exists listings_ideal_trade_description_check;

alter table public.listings
    add constraint listings_ideal_trade_description_check
    check (
        ideal_trade_description is null
        or (
            'trade' = any (transaction_types)
            and char_length(ideal_trade_description) <= 1000
            and ideal_trade_description ~ '[^[:space:]]'
        )
    );

create or replace function public.normalize_listing_ideal_trade_description()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.ideal_trade_description is not null then
        new.ideal_trade_description := nullif(
            btrim(new.ideal_trade_description, E' \t\n\r\f' || chr(11)),
            ''
        );
    end if;

    if not ('trade' = any (new.transaction_types)) then
        new.ideal_trade_description := null;
    end if;

    return new;
end;
$$;

revoke all on function public.normalize_listing_ideal_trade_description() from public;

drop trigger if exists normalize_listing_ideal_trade_description
    on public.listings;

create trigger normalize_listing_ideal_trade_description
    before insert or update of ideal_trade_description, transaction_types
    on public.listings
    for each row
    execute function public.normalize_listing_ideal_trade_description();

commit;
