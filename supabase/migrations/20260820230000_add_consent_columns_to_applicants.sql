-- sms_consent and tos_consent previously lived only inside applicants.responses
-- (jsonb), which meant every read needed an unsafe unwrap (see hasSmsConsent()
-- in app/admin/actions.ts, added to gate the approval-text send) and there was
-- no way to guarantee either was ever recorded. Promoting both to real columns.
--
-- Backfilled from the existing responses blob. Rows with no recorded value
-- (or a malformed one) default to false -- no consent on file means we can't
-- text them / can't treat them as having agreed to the ToS, so false is the
-- only safe default, not just a convenient one.
alter table applicants add column sms_consent boolean;
alter table applicants add column tos_consent boolean;

update applicants
set sms_consent = coalesce((responses ->> 'sms_consent')::boolean, false),
    tos_consent = coalesce((responses ->> 'tos_consent')::boolean, false)
where sms_consent is null or tos_consent is null;

alter table applicants
    alter column sms_consent set not null,
    alter column sms_consent set default false,
    alter column tos_consent set not null,
    alter column tos_consent set default false;
