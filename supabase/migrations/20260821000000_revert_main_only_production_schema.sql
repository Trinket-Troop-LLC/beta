-- Reverts the four 20260819* migrations that were applied to the production
-- Trinket Troop project by main's duplicate beta-app implementation.
--
-- RUN THIS ENTIRE FILE. Do not highlight and run only the DDL near the end;
-- the fingerprint checks, table locks, and data preflight are safety-critical.
--
-- This migration targets the production state verified on 2026-08-21. It is
-- deliberately NOT a convergence migration for beta-internal. Production has
-- two earlier beta-internal changes that must survive this cleanup:
--
--   - bulletin_replies.parent_reply_id (+ its index)
--   - listing_offers (+ origin_type = 'listing')
--
-- Production does not have beta-internal's later status, DELETE-policy,
-- closed_reason, Realtime, bulletin-visibility, notification, review, consent,
-- lend, or last_active_at migrations. The preflight below verifies that exact
-- mixed state before changing anything.
--
-- Live-data preflight on 2026-08-21 found no conversations, no values in the
-- two main-only offer columns, no rows in listing_offers, and two bulletin
-- posts whose visibility was 'global'. The migration locks affected tables
-- before repeating the destructive-data checks, so that state cannot change
-- between validation and DDL.
--
-- Replay behavior is intentional:
--   - no main-only structural fingerprints: NOTICE + no-op (already clean,
--     fresh final-main database, or beta-internal)
--   - every verified fingerprint: perform the cleanup
--   - a partial or differently interleaved state: abort and roll back

begin;

do $migration$
declare
    main_fingerprint_count integer;
    expected_main_fingerprint_count constant integer := 9;
    early_beta_reply_fingerprint_count integer;
    expected_early_beta_reply_fingerprint_count constant integer := 2;
    early_beta_offer_fingerprint_count integer;
    expected_early_beta_offer_fingerprint_count constant integer := 3;
    exposed_project_ref text := nullif(
        current_setting('app.settings.project_ref', true),
        ''
    );
begin
    -- Count only main-specific structural fingerprints. Realtime membership
    -- is checked separately because beta-internal later wants the same state.
    select
        (exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'conversations'
              and column_name = 'listing_id'
        ))::integer
        + (exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'conversations'
              and column_name = 'offered_listing_id'
        ))::integer
        + (exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = 'conversations'
              and c.conname = 'conversations_offer_requires_listing'
              and c.contype = 'c'
              and c.convalidated
        ))::integer
        + (exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = 'conversations'
              and c.conname = 'conversations_offered_listing_distinct'
              and c.contype = 'c'
              and c.convalidated
        ))::integer
        + (exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'conversations'
              and indexname = 'conversations_listing_id_idx'
        ))::integer
        + (exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'conversations'
              and policyname = 'Participants can delete their pending conversations'
              and cmd = 'DELETE'
        ))::integer
        + (exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = 'conversations'
              and c.conname = 'conversations_status_check'
              and c.contype = 'c'
              and c.convalidated
              and pg_get_constraintdef(c.oid) like '%completed%'
        ))::integer
        + (exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'bulletin_posts'
              and column_name = 'visibility'
              and is_nullable = 'NO'
              and column_default like '%global%'
        ))::integer
        + (exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = 'bulletin_posts'
              and c.contype = 'c'
              and c.convalidated
              and pg_get_constraintdef(c.oid) like '%visibility%'
              and pg_get_constraintdef(c.oid) like '%global%'
        ))::integer
    into main_fingerprint_count;

    if main_fingerprint_count = 0 then
        raise notice
            'No main-only production schema detected; reconciliation is a no-op';
        return;
    end if;

    if main_fingerprint_count <> expected_main_fingerprint_count then
        raise exception using message = format(
            'Refusing cleanup: found %s of %s main-only schema fingerprints',
            main_fingerprint_count,
            expected_main_fingerprint_count
        );
    end if;

    -- Block writes before the data checks. Locks are held through COMMIT.
    execute $ddl$
        lock table public.conversations,
                   public.bulletin_posts,
                   public.bulletin_replies
        in access exclusive mode
    $ddl$;

    -- Main added conversations directly to the publication. Check direct
    -- membership, not pg_publication_tables, which can include FOR ALL TABLES
    -- or TABLES IN SCHEMA membership that DROP TABLE must not undo.
    if not exists (
        select 1
        from pg_publication p
        join pg_publication_rel pr on pr.prpubid = p.oid
        join pg_class t on t.oid = pr.prrelid
        join pg_namespace n on n.oid = t.relnamespace
        where p.pubname = 'supabase_realtime'
          and n.nspname = 'public'
          and t.relname = 'conversations'
    ) then
        raise exception using message =
            'Refusing cleanup: conversations is not a direct Realtime member';
    end if;

    -- Production has two complete early beta-internal migrations; a fresh
    -- main-only replay has neither. Validate each migration independently so
    -- an absent migration is fine but a partially-applied one fails closed.
    select
        (exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'bulletin_replies'
              and column_name = 'parent_reply_id'
        ))::integer
        + (exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'bulletin_replies'
              and indexname = 'bulletin_replies_parent_reply_id_idx'
        ))::integer
    into early_beta_reply_fingerprint_count;

    select
        (exists (
            select 1
            from pg_class t
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = 'listing_offers'
              and t.relkind in ('r', 'p')
              and t.relrowsecurity
        ))::integer
        + (exists (
            select 1
            from pg_policies
            where schemaname = 'public'
              and tablename = 'listing_offers'
              and policyname = 'Members view offers they sent or received'
              and cmd = 'SELECT'
        ))::integer
        + (exists (
            select 1
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = 'conversations'
              and c.conname = 'conversations_origin_type_check'
              and c.contype = 'c'
              and c.convalidated
              and pg_get_constraintdef(c.oid) like '%listing%'
        ))::integer
    into early_beta_offer_fingerprint_count;

    if early_beta_reply_fingerprint_count not in (
        0,
        expected_early_beta_reply_fingerprint_count
    ) then
        raise exception using message =
            'Refusing cleanup: beta reply-parent migration is only partially applied';
    end if;

    if early_beta_offer_fingerprint_count not in (
        0,
        expected_early_beta_offer_fingerprint_count
    ) then
        raise exception using message =
            'Refusing cleanup: beta listing-offers migration is only partially applied';
    end if;

    -- The hardcoded ref only applies to the verified mixed production state.
    -- A fresh main-only replay (zero early-beta markers) is environment-neutral.
    if early_beta_reply_fingerprint_count =
           expected_early_beta_reply_fingerprint_count
       and early_beta_offer_fingerprint_count =
           expected_early_beta_offer_fingerprint_count
       and exposed_project_ref is not null
       and exposed_project_ref <> 'ctmdrcnpfjewudsowvkj' then
        raise exception using message = format(
            'Refusing cleanup: connected project ref is %s, not production',
            exposed_project_ref
        );
    end if;

    -- Reject every later beta-internal marker that would change the desired
    -- status, policy, Realtime, bulletin, or companion-feature end state.
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'conversations'
          and policyname = 'Recipient can delete a pending conversation request'
    ) or exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and indexname in (
              'conversations_one_active_per_listing',
              'conversations_one_pending_per_requester_and_origin'
          )
    ) or exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and (
              (table_name = 'conversations'
               and column_name in ('transaction_type', 'closed_reason'))
              or (table_name = 'listings'
                  and column_name = 'active_transaction_type')
              or (table_name = 'users'
                  and column_name = 'last_active_at')
              or (table_name = 'bulletin_posts'
                  and column_name = 'allow_messages')
              or (table_name = 'applicants'
                  and column_name in ('sms_consent', 'tos_consent'))
          )
    ) or to_regclass('public.notifications') is not null
       or to_regclass('public.exchange_reviews') is not null
       or to_regclass('public.push_subscriptions') is not null
       or exists (
           select 1
           from pg_policies
           where schemaname = 'public'
             and tablename = 'messages'
             and policyname =
                 'Participants can mark messages read in their conversations'
       )
       or exists (
           select 1
           from pg_policies
           where schemaname = 'public'
             and tablename = 'bulletin_posts'
             and policyname =
                 'Users can view public posts or troop posts from friends'
       )
       or exists (
           select 1
           from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'listings'
       ) then
        raise exception using message =
            'Refusing cleanup: later beta-internal schema is present';
    end if;

    if exists (
        select 1
        from public.conversations
        where status not in ('pending', 'active')
    ) then
        raise exception using message =
            'Refusing cleanup: completed/closed conversations require a data decision';
    end if;

    if exists (
        select 1
        from public.conversations
        where listing_id is not null
           or offered_listing_id is not null
    ) then
        raise exception using message =
            'Refusing cleanup: main-only conversation offer columns contain data';
    end if;

    if exists (
        select 1
        from public.bulletin_posts
        where visibility is distinct from 'global'
    ) then
        raise exception using message =
            'Refusing cleanup: non-global bulletin visibility would be lost';
    end if;

    -- Undo 20260819000000_link_conversations_to_listings.sql. Leave
    -- listing_offers and origin_type='listing' untouched.
    execute $ddl$
        drop policy if exists
            "Participants can delete their pending conversations"
            on public.conversations
    $ddl$;

    execute $ddl$
        alter table public.conversations
            drop constraint if exists conversations_offer_requires_listing,
            drop constraint if exists conversations_offered_listing_distinct
    $ddl$;

    execute $ddl$
        drop index if exists public.conversations_listing_id_idx
    $ddl$;

    execute $ddl$
        alter table public.conversations
            drop column if exists offered_listing_id,
            drop column if exists listing_id
    $ddl$;

    -- Undo 20260819010000. beta-internal's later closed-status migration is
    -- absent here, so restore the original pending/active vocabulary exactly.
    execute $ddl$
        alter table public.conversations
            drop constraint if exists conversations_status_check
    $ddl$;

    execute $ddl$
        alter table public.conversations
            add constraint conversations_status_check
            check (status in ('pending', 'active'))
    $ddl$;

    -- Undo 20260819020000. beta-internal can re-add direct membership when
    -- its corresponding code/schema is promoted later.
    execute $ddl$
        alter publication supabase_realtime
            drop table public.conversations
    $ddl$;

    -- Undo 20260819030000: remove visibility-dependent policies before the
    -- column, then restore the original authenticated SELECT policies.
    execute $ddl$
        drop policy if exists
            "Authenticated users can view bulletin posts"
            on public.bulletin_posts
    $ddl$;

    execute $ddl$
        drop policy if exists
            "Authenticated users can view bulletin replies"
            on public.bulletin_replies
    $ddl$;

    execute $ddl$
        alter table public.bulletin_posts
            drop column if exists visibility
    $ddl$;

    execute $ddl$
        create policy "Authenticated users can view bulletin posts"
        on public.bulletin_posts
        for select
        to authenticated
        using (true)
    $ddl$;

    execute $ddl$
        create policy "Authenticated users can view bulletin replies"
        on public.bulletin_replies
        for select
        to authenticated
        using (true)
    $ddl$;
end
$migration$;

commit;
