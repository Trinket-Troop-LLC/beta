begin;

alter table public.exchange_reviews
    add column thank_you_note text;

alter table public.exchange_reviews
    add constraint exchange_reviews_thank_you_note_length_check
    check (thank_you_note is null or char_length(thank_you_note) <= 1000);

-- A participant used to be able to read the other participant's complete
-- review row, including its rating and private experience comment. Reviewers
-- only need their own row for the duplicate-submission check. Public profile
-- thank-you notes are projected separately by trusted server code.
drop policy if exists "Participants can view reviews from their conversations"
    on public.exchange_reviews;

create policy "Reviewers can view their own reviews"
    on public.exchange_reviews
    for select
    to authenticated
    using (reviewer_id = (select auth.uid()));

-- Service-role clients bypass RLS. This policy preserves full review access
-- for signed-in application admins as well.
create policy "Admins can view all reviews"
    on public.exchange_reviews
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.users
            where users.id = (select auth.uid())
              and users.role = 'admin'
        )
    );

commit;
