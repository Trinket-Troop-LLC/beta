-- Message bulletin: public posts (like short threads), with public replies.
-- Messaging someone privately about a post is handled separately via
-- conversations.requestConversation, which starts a pending conversation
-- gated by acceptance — this table only covers the public thread itself.

create table bulletin_posts (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references users(id) on delete cascade,
    content text not null,
    image_path text,
    created_at timestamptz default now()
);

create table bulletin_replies (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references bulletin_posts(id) on delete cascade,
    author_id uuid not null references users(id) on delete cascade,
    content text not null,
    created_at timestamptz default now()
);

alter table bulletin_posts enable row level security;
alter table bulletin_replies enable row level security;

create policy "Authenticated users can view bulletin posts"
on bulletin_posts for select
to authenticated
using (true);

create policy "Authenticated users can view bulletin replies"
on bulletin_replies for select
to authenticated
using (true);

create policy "Users can create their own bulletin posts"
on bulletin_posts for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can create their own bulletin replies"
on bulletin_replies for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can delete their own bulletin posts"
on bulletin_posts for delete
to authenticated
using (auth.uid() = author_id);

create policy "Users can delete their own bulletin replies"
on bulletin_replies for delete
to authenticated
using (auth.uid() = author_id);