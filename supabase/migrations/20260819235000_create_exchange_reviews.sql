create table exchange_reviews (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    reviewer_id uuid not null references users(id) on delete cascade,
    reviewee_id uuid not null references users(id) on delete cascade,
    rating smallint not null check (rating between 1 and 5),
    comment text,
    created_at timestamptz default now(),
    unique (conversation_id, reviewer_id),
    check (reviewer_id != reviewee_id)
);

alter table exchange_reviews enable row level security;

create policy "Participants can view reviews from their conversations"
on exchange_reviews for select
to authenticated
using (
    exists (
        select 1 from conversations
        where conversations.id = exchange_reviews.conversation_id
        and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())
    )
);

-- Reviews are only ever created by the server via the admin client (see
-- app/(beta-app)/review/[conversationId]/actions.ts), after independently
-- verifying the reviewer is a participant in a closed conversation and
-- hasn't already reviewed it -- deliberately no insert policy for
-- authenticated users.
