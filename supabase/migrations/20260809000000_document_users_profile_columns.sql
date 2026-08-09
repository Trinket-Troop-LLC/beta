-- public.users gained first_name, last_name, phone_number, and preferred_name
-- directly in the dashboard (no migration) as part of the approval flow now
-- migrating full applicant data onto the profile. Documents the current live
-- shape — all plain nullable text columns, no additional constraints beyond
-- what 20260805000000_document_existing_users_table.sql already covers.
-- Idempotent: safe to run against the existing production table.

alter table public.users
    add column if not exists first_name text,
    add column if not exists last_name text,
    add column if not exists phone_number text,
    add column if not exists preferred_name text;
