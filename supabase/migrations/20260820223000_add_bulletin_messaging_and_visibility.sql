alter table bulletin_posts add column allow_messages boolean not null default true;
alter table bulletin_posts add column visibility text not null default 'public' check (visibility in ('public', 'troop'));

drop policy "Authenticated users can view bulletin posts" on bulletin_posts;

create policy "Users can view public posts or troop posts from friends"
on bulletin_posts for select
to authenticated
using (
    visibility = 'public'
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