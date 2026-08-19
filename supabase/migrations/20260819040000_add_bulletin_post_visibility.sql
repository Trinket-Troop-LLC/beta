-- Lets a post be visible only to the author's troop (accepted friends) instead
-- of everyone. Replies inherit their parent post's visibility rather than
-- getting their own column -- a troop-only post's replies shouldn't be
-- independently queryable by someone outside that audience.
alter table bulletin_posts
    add column visibility text not null default 'global'
    check (visibility in ('global', 'troop'));

drop policy "Authenticated users can view bulletin posts" on bulletin_posts;
create policy "Authenticated users can view bulletin posts"
on bulletin_posts for select
to authenticated
using (
    visibility = 'global'
    or author_id = auth.uid()
    or exists (
        select 1 from friendships
        where status = 'accepted'
        and (
            (requester_id = auth.uid() and addressee_id = bulletin_posts.author_id)
            or (addressee_id = auth.uid() and requester_id = bulletin_posts.author_id)
        )
    )
);

drop policy "Authenticated users can view bulletin replies" on bulletin_replies;
create policy "Authenticated users can view bulletin replies"
on bulletin_replies for select
to authenticated
using (
    exists (
        select 1 from bulletin_posts
        where bulletin_posts.id = bulletin_replies.post_id
        and (
            bulletin_posts.visibility = 'global'
            or bulletin_posts.author_id = auth.uid()
            or exists (
                select 1 from friendships
                where status = 'accepted'
                and (
                    (requester_id = auth.uid() and addressee_id = bulletin_posts.author_id)
                    or (addressee_id = auth.uid() and requester_id = bulletin_posts.author_id)
                )
            )
        )
    )
);
