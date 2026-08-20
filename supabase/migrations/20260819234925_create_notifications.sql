create table notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references users(id) on delete cascade,
    type text not null check (type in (
        'listing_interest',
        'friend_request',
        'friend_request_accepted',
        'bulletin_reply',
        'exchange_cancelled',
        'exchange_complete_review_prompt'
    )),
    actor_id uuid references users(id) on delete set null,
    related_listing_id uuid references listings(id) on delete set null,
    related_conversation_id uuid references conversations(id) on delete set null,
    related_bulletin_post_id uuid references bulletin_posts(id) on delete set null,
    read_at timestamptz,
    created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
on notifications for select
to authenticated
using (auth.uid() = recipient_id);

create policy "Users can mark their own notifications read"
on notifications for update
to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

-- Notifications are only ever created by the server via the admin client
-- (see lib/notifications/create.ts) -- deliberately no insert policy for
-- authenticated users.