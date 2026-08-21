begin;

alter table public.listing_offers
    drop constraint if exists listing_offers_status_check;

alter table public.listing_offers
    add constraint listing_offers_status_check
    check (status in ('pending', 'accepted', 'declined', 'withdrawn'));

-- Offer edits use updated_at as an optimistic row version. Keep the function
-- table-specific so it cannot collide with another timestamp trigger.
create or replace function public.set_listing_offer_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.set_listing_offer_updated_at() from public;

drop trigger if exists set_listing_offer_updated_at_before_update
    on public.listing_offers;

create trigger set_listing_offer_updated_at_before_update
    before update on public.listing_offers
    for each row
    execute function public.set_listing_offer_updated_at();

create index if not exists listing_offers_pending_offered_listing_idx
    on public.listing_offers (offered_listing_id)
    where status = 'pending';

-- A listing edit and a new request can race even when both server actions
-- validate first. These three triggers serialize on the listing rows and keep
-- pending work from referring to an exchange option that no longer exists.
create or replace function public.guard_listing_pending_exchange_types()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.transaction_types is not distinct from old.transaction_types then
        return new;
    end if;

    if exists (
        select 1
        from public.conversations as conversation
        where conversation.origin_type = 'listing'
          and conversation.origin_id = new.id
          and conversation.status = 'pending'
          and conversation.transaction_type is not null
          and not (conversation.transaction_type = any (new.transaction_types))
    ) or (
        not ('trade' = any (new.transaction_types))
        and exists (
            select 1
            from public.listing_offers as offer
            where offer.status = 'pending'
              and (
                  offer.listing_id = new.id
                  or offer.offered_listing_id = new.id
              )
        )
    ) then
        raise exception using
            errcode = '23514',
            message = 'listings_pending_exchange_types_check',
            constraint = 'listings_pending_exchange_types_check';
    end if;

    return new;
end;
$$;

revoke all on function public.guard_listing_pending_exchange_types() from public;

drop trigger if exists guard_listing_pending_exchange_types_before_update
    on public.listings;

create trigger guard_listing_pending_exchange_types_before_update
    before update of transaction_types on public.listings
    for each row
    execute function public.guard_listing_pending_exchange_types();

create or replace function public.validate_pending_listing_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    listing_row public.listings%rowtype;
begin
    if tg_op = 'INSERT' and auth.role() is distinct from 'service_role' then
        if new.origin_type = 'offer' then
            raise exception using
                errcode = '42501',
                message = 'Offer conversations must be created through the server.';
        end if;

        if new.origin_type = 'listing'
           and (
               new.status <> 'pending'
               or new.initiated_by is distinct from auth.uid()
           ) then
            raise exception using
                errcode = '42501',
                message = 'A listing request must be created by its requester.';
        end if;
    end if;

    if tg_op = 'UPDATE' then
        if old.origin_type in ('listing', 'offer')
           or new.origin_type in ('listing', 'offer') then
            if row(
                new.id,
                new.origin_type,
                new.origin_id,
                new.participant_one_id,
                new.participant_two_id,
                new.initiated_by,
                new.created_at
            ) is distinct from row(
                old.id,
                old.origin_type,
                old.origin_id,
                old.participant_one_id,
                old.participant_two_id,
                old.initiated_by,
                old.created_at
            ) then
                raise exception using
                    errcode = '23514',
                    message = 'listing_exchange_conversation_identity_check',
                    constraint = 'listing_exchange_conversation_identity_check';
            end if;

            if auth.role() is distinct from 'service_role' then
                if new.status is distinct from old.status
                   or new.closed_reason is distinct from old.closed_reason then
                    raise exception using
                        errcode = '42501',
                        message = 'Listing exchange state must be changed through the server.';
                end if;

                if new.transaction_type is distinct from old.transaction_type
                   and not (
                       old.origin_type = 'listing'
                       and old.status = 'pending'
                       and new.status = 'pending'
                       and auth.uid() is not distinct from old.initiated_by
                   ) then
                    raise exception using
                        errcode = '42501',
                        message = 'Only a pending listing requester can change the exchange type.';
                end if;
            end if;
        end if;
    end if;

    if new.origin_type <> 'listing' or new.status <> 'pending' then
        return new;
    end if;

    if new.origin_id is null
       or new.transaction_type is null
       or new.transaction_type not in ('sell', 'gift', 'lend') then
        raise exception using
            errcode = '23514',
            message = 'pending_listing_conversation_state_check',
            constraint = 'pending_listing_conversation_state_check';
    end if;

    -- Waiting for an existing request before taking the listing lock keeps
    -- the lock order compatible with request acceptance.
    if tg_op = 'INSERT' then
        perform conversation.id
        from public.conversations as conversation
        where conversation.origin_type = 'listing'
          and conversation.origin_id = new.origin_id
          and conversation.status = 'pending'
          and (
              (
                  conversation.participant_one_id = new.participant_one_id
                  and conversation.participant_two_id = new.participant_two_id
              )
              or (
                  conversation.participant_one_id = new.participant_two_id
                  and conversation.participant_two_id = new.participant_one_id
              )
          )
        order by conversation.id
        for update;
    end if;

    select listing.*
    into listing_row
    from public.listings as listing
    where listing.id = new.origin_id
    for update;

    if listing_row.id is null
       or listing_row.status <> 'active'
       or listing_row.owner_id = new.initiated_by
       or not (
           (
               new.participant_one_id = new.initiated_by
               and new.participant_two_id = listing_row.owner_id
           )
           or (
               new.participant_two_id = new.initiated_by
               and new.participant_one_id = listing_row.owner_id
           )
       )
       or (
           tg_op = 'INSERT'
           and auth.role() is distinct from 'service_role'
           and (
               new.participant_one_id <> new.initiated_by
               or new.participant_two_id <> listing_row.owner_id
           )
       )
       or not (new.transaction_type = any (listing_row.transaction_types)) then
        raise exception using
            errcode = '23514',
            message = 'pending_listing_conversation_state_check',
            constraint = 'pending_listing_conversation_state_check';
    end if;

    return new;
end;
$$;

revoke all on function public.validate_pending_listing_conversation() from public;

drop trigger if exists validate_pending_listing_conversation_before_write
    on public.conversations;

create trigger validate_pending_listing_conversation_before_write
    before insert or update of id, participant_one_id, participant_two_id,
        initiated_by, origin_type, origin_id, status, transaction_type,
        closed_reason, created_at
    on public.conversations
    for each row
    execute function public.validate_pending_listing_conversation();

create or replace function public.validate_pending_listing_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    locked_listing_id uuid;
    target_listing public.listings%rowtype;
    offered_listing public.listings%rowtype;
begin
    if tg_op = 'UPDATE' then
        if new.listing_id is distinct from old.listing_id
           or new.offerer_id is distinct from old.offerer_id
           or (
               new.offered_listing_id is distinct from old.offered_listing_id
               and (old.status <> 'pending' or new.status <> 'pending')
           ) then
            raise exception using
                errcode = '23514',
                message = 'pending_listing_offer_identity_check',
                constraint = 'pending_listing_offer_identity_check';
        end if;
    end if;

    if new.status <> 'pending' then
        return new;
    end if;

    -- If this insert competes with an existing offer transition, wait for
    -- that child row before taking listing locks. This matches the acceptance
    -- RPC's child-then-listings lock order.
    if tg_op = 'INSERT' then
        perform offer.id
        from public.listing_offers as offer
        where offer.listing_id = new.listing_id
          and offer.offerer_id = new.offerer_id
          and offer.status = 'pending'
        order by offer.id
        for update;
    end if;

    -- Every writer that can create or retarget a pending offer takes these
    -- locks in UUID order, matching the acceptance RPC below.
    for locked_listing_id in
        select listing.id
        from public.listings as listing
        where listing.id in (new.listing_id, new.offered_listing_id)
        order by listing.id
        for update
    loop
        null;
    end loop;

    select listing.*
    into target_listing
    from public.listings as listing
    where listing.id = new.listing_id;

    select listing.*
    into offered_listing
    from public.listings as listing
    where listing.id = new.offered_listing_id;

    if target_listing.id is null
       or offered_listing.id is null
       or target_listing.id = offered_listing.id
       or target_listing.status <> 'active'
       or offered_listing.status <> 'active'
       or not ('trade' = any (target_listing.transaction_types))
       or not ('trade' = any (offered_listing.transaction_types))
       or target_listing.owner_id = new.offerer_id
       or offered_listing.owner_id <> new.offerer_id then
        raise exception using
            errcode = '23514',
            message = 'pending_listing_offer_state_check',
            constraint = 'pending_listing_offer_state_check';
    end if;

    return new;
end;
$$;

revoke all on function public.validate_pending_listing_offer() from public;

drop trigger if exists validate_pending_listing_offer_before_write
    on public.listing_offers;

create trigger validate_pending_listing_offer_before_write
    before insert or update of listing_id, offered_listing_id, offerer_id, status
    on public.listing_offers
    for each row
    execute function public.validate_pending_listing_offer();

-- Accepting a trade used to span several REST calls and compensating writes.
-- This function makes the offer transition, both reservations, and the chat
-- activation one database transaction, so no partial accepted deal can leak.
create or replace function public.accept_pending_listing_offer(
    p_offer_id uuid,
    p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    offer_row public.listing_offers%rowtype;
    target_listing public.listings%rowtype;
    offered_listing public.listings%rowtype;
    locked_listing_id uuid;
    conversation_id uuid;
    changed_rows integer;
begin
    if auth.role() is distinct from 'service_role' then
        raise exception using
            errcode = '42501',
            message = 'Service role required.';
    end if;

    select offer.*
    into offer_row
    from public.listing_offers as offer
    where offer.id = p_offer_id
      and offer.status = 'pending'
    for update;

    if offer_row.id is null then
        return null;
    end if;

    for locked_listing_id in
        select listing.id
        from public.listings as listing
        where listing.id in (offer_row.listing_id, offer_row.offered_listing_id)
        order by listing.id
        for update
    loop
        null;
    end loop;

    select listing.*
    into target_listing
    from public.listings as listing
    where listing.id = offer_row.listing_id;

    select listing.*
    into offered_listing
    from public.listings as listing
    where listing.id = offer_row.offered_listing_id;

    if target_listing.id is null
       or offered_listing.id is null
       or target_listing.owner_id <> p_owner_id
       or offer_row.offerer_id = p_owner_id
       or offered_listing.owner_id <> offer_row.offerer_id
       or target_listing.status <> 'active'
       or offered_listing.status <> 'active'
       or not ('trade' = any (target_listing.transaction_types))
       or not ('trade' = any (offered_listing.transaction_types)) then
        return null;
    end if;

    update public.listings
    set status = 'reserved',
        active_transaction_type = 'trade'
    where id in (offer_row.listing_id, offer_row.offered_listing_id)
      and status = 'active';

    get diagnostics changed_rows = row_count;
    if changed_rows <> 2 then
        raise exception 'Could not reserve both trade listings.';
    end if;

    update public.listing_offers
    set status = 'accepted'
    where id = offer_row.id
      and status = 'pending';

    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
        raise exception 'Could not claim the pending listing offer.';
    end if;

    select conversation.id
    into conversation_id
    from public.conversations as conversation
    where conversation.origin_type = 'offer'
      and conversation.origin_id = offer_row.listing_id
      and conversation.status <> 'closed'
      and (
          (
              conversation.participant_one_id = p_owner_id
              and conversation.participant_two_id = offer_row.offerer_id
          )
          or (
              conversation.participant_one_id = offer_row.offerer_id
              and conversation.participant_two_id = p_owner_id
          )
      )
    order by
        case when conversation.status = 'active' then 0 else 1 end,
        conversation.created_at desc
    limit 1
    for update;

    if conversation_id is null then
        insert into public.conversations (
            participant_one_id,
            participant_two_id,
            origin_type,
            origin_id,
            transaction_type,
            status,
            initiated_by
        ) values (
            p_owner_id,
            offer_row.offerer_id,
            'offer',
            offer_row.listing_id,
            null,
            'active',
            p_owner_id
        )
        returning id into conversation_id;
    else
        update public.conversations
        set status = 'active',
            closed_reason = null,
            updated_at = now()
        where id = conversation_id;
    end if;

    return conversation_id;
end;
$$;

revoke all on function public.accept_pending_listing_offer(uuid, uuid)
    from public, anon, authenticated;
grant execute on function public.accept_pending_listing_offer(uuid, uuid)
    to service_role;

-- Sell/gift/lend request acceptance uses the same transaction boundary for
-- its one listing and existing pending conversation.
create or replace function public.accept_pending_listing_request(
    p_conversation_id uuid,
    p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    conversation_row public.conversations%rowtype;
    listing_row public.listings%rowtype;
    changed_rows integer;
begin
    if auth.role() is distinct from 'service_role' then
        raise exception using
            errcode = '42501',
            message = 'Service role required.';
    end if;

    select conversation.*
    into conversation_row
    from public.conversations as conversation
    where conversation.id = p_conversation_id
      and conversation.status = 'pending'
    for update;

    if conversation_row.id is null
       or conversation_row.origin_type <> 'listing'
       or conversation_row.origin_id is null
       or conversation_row.initiated_by = p_owner_id
       or conversation_row.initiated_by not in (
           conversation_row.participant_one_id,
           conversation_row.participant_two_id
       )
       or p_owner_id not in (
           conversation_row.participant_one_id,
           conversation_row.participant_two_id
       )
       or conversation_row.transaction_type is null
       or conversation_row.transaction_type not in ('sell', 'gift', 'lend') then
        return null;
    end if;

    select listing.*
    into listing_row
    from public.listings as listing
    where listing.id = conversation_row.origin_id
    for update;

    if listing_row.id is null
       or listing_row.owner_id <> p_owner_id
       or listing_row.status <> 'active'
       or not (
           conversation_row.transaction_type = any (listing_row.transaction_types)
       ) then
        return null;
    end if;

    update public.listings
    set status = 'reserved',
        active_transaction_type = conversation_row.transaction_type
    where id = listing_row.id
      and owner_id = p_owner_id
      and status = 'active';

    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
        raise exception 'Could not reserve the requested listing.';
    end if;

    update public.conversations
    set status = 'active',
        updated_at = now()
    where id = conversation_row.id
      and status = 'pending';

    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
        raise exception 'Could not activate the listing conversation.';
    end if;

    return conversation_row.id;
end;
$$;

revoke all on function public.accept_pending_listing_request(uuid, uuid)
    from public, anon, authenticated;
grant execute on function public.accept_pending_listing_request(uuid, uuid)
    to service_role;

commit;
