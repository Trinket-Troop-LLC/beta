-- Photos for the bulletin: separate tables per parent type (post vs. reply)
-- rather than one shared table with nullable foreign keys, so each stays
-- simple to query and its RLS policy only ever has one ownership path to check.

create table bulletin_post_photos (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references bulletin_posts(id) on delete cascade,
    storage_path text not null,
    position int not null default 0,
    created_at timestamptz default now()
);

create table bulletin_reply_photos (
    id uuid primary key default gen_random_uuid(),
    reply_id uuid not null references bulletin_replies(id) on delete cascade,
    storage_path text not null,
    position int not null default 0,
    created_at timestamptz default now()
);

alter table bulletin_post_photos enable row level security;
alter table bulletin_reply_photos enable row level security;

-- Public read, same as posts/replies themselves
create policy "Authenticated users can view bulletin post photos"
on bulletin_post_photos for select
to authenticated
using (true);

create policy "Authenticated users can view bulletin reply photos"
on bulletin_reply_photos for select
to authenticated
using (true);

-- Only the post's/reply's own author can attach or remove photos on it
create policy "Users can add photos to their own bulletin posts"
on bulletin_post_photos for insert
to authenticated
with check (
    exists (
        select 1 from bulletin_posts
        where bulletin_posts.id = bulletin_post_photos.post_id
        and bulletin_posts.author_id = auth.uid()
    )
);

create policy "Users can delete photos from their own bulletin posts"
on bulletin_post_photos for delete
to authenticated
using (
    exists (
        select 1 from bulletin_posts
        where bulletin_posts.id = bulletin_post_photos.post_id
        and bulletin_posts.author_id = auth.uid()
    )
);

create policy "Users can add photos to their own bulletin replies"
on bulletin_reply_photos for insert
to authenticated
with check (
    exists (
        select 1 from bulletin_replies
        where bulletin_replies.id = bulletin_reply_photos.reply_id
        and bulletin_replies.author_id = auth.uid()
    )
);

create policy "Users can delete photos from their own bulletin replies"
on bulletin_reply_photos for delete
to authenticated
using (
    exists (
        select 1 from bulletin_replies
        where bulletin_replies.id = bulletin_reply_photos.reply_id
        and bulletin_replies.author_id = auth.uid()
    )
);