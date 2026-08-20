create table push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
on push_subscriptions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own push subscriptions"
on push_subscriptions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
on push_subscriptions for delete
to authenticated
using (auth.uid() = user_id);

-- Sending push notifications reads across users (see
-- lib/notifications/push-send.ts) and goes through the admin client, same as
-- the rest of the notification pipeline -- these policies only cover a
-- user managing their own device subscriptions from the client.
