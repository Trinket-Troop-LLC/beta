-- The "Users can update their own profiles" policy (from
-- 20260805000000_document_existing_users_table.sql) required `role = 'user'`
-- in its WITH CHECK clause, which meant admin accounts were silently blocked
-- by RLS from editing their own profile — the check re-evaluates the *new*
-- row, and an admin's role stays 'admin' after the update, never 'user'.
-- Surfaced by the new self-service profile editor, which admins hit too.
--
-- Fix: compare against the row's own current role instead of hardcoding
-- 'user'. This allows any role to self-update while still blocking a user
-- from changing their own role (a self-update can't smuggle in a different
-- role than the one already on the row, since the subquery reads it fresh
-- each check).
--
-- Applied directly against the live database already; this migration exists
-- to document that change and keep a from-scratch bootstrap consistent with
-- production, per this repo's rule against hand-configuring RLS in the
-- dashboard.

alter policy "Users can update their own profiles"
    on public.users
    to authenticated
    using (
        auth.uid() = id
    )
    with check (
        auth.uid() = id
        and role = (select role from public.users where id = auth.uid())
    );
