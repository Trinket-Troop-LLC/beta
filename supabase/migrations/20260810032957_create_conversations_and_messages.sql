create table conversations (
    id uuid primary key default gen_random_uuid(),
    participant_one_id uuid not null references users(id) on delete cascade,
    participant_two_id uuid not null references users(id) on delete cascade,
    origin_type text not null check (origin_type in ('offer', 'message_board', 'direct')),
    origin_id uuid,
    status text not null default 'active' check (status in ('pending', 'active')),
    initiated_by uuid not null references users(id) on delete cascade,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    check (participant_one_id != participant_two_id)
);

create table messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    sender_id uuid not null references users(id) on delete cascade,
    content text,
    image_path text,
    created_at timestamptz default now(),
    read_at timestamptz,
    check (content is not null or image_path is not null)
);

alter table conversations enable row level security;
alter table messages enable row level security;

create or replace function touch_conversation_on_message()
returns trigger as $$
begin
    update conversations set updated_at = now() where id = new.conversation_id;
    return new;
end;
$$ language plpgsql;

create trigger update_conversation_timestamp
after insert on messages
for each row
execute function touch_conversation_on_message();

create policy "Participants can view their conversations"
on conversations for select
to authenticated
using (
    auth.uid() = participant_one_id or auth.uid() = participant_two_id
);

create policy "Users can create conversations they're part of"
on conversations for insert
to authenticated
with check (
    auth.uid() = participant_one_id or auth.uid() = participant_two_id
);

create policy "Participants can update conversation status"
on conversations for update
to authenticated
using (
    auth.uid() = participant_one_id or auth.uid() = participant_two_id
)
with check (
    auth.uid() = participant_one_id or auth.uid() = participant_two_id
);

create policy "Participants can view messages in their conversations"
on messages for select
to authenticated
using (
    exists (
        select 1 from conversations
        where conversations.id = messages.conversation_id
        and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())
    )
);

create policy "Participants can send messages in active conversations"
on messages for insert
to authenticated
with check (
    sender_id = auth.uid()
    and exists (
        select 1 from conversations
        where conversations.id = messages.conversation_id
        and conversations.status = 'active'
        and (conversations.participant_one_id = auth.uid() or conversations.participant_two_id = auth.uid())
    )
);