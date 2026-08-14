-- Lets a reply target a specific earlier reply instead of only the post
-- itself, so replying to a reply can show a lightweight "replying to @x"
-- attribution in what's still a flat list, rather than building real
-- nested/indented threading.

alter table bulletin_replies
    add column parent_reply_id uuid references bulletin_replies(id) on delete set null;

create index bulletin_replies_parent_reply_id_idx on bulletin_replies(parent_reply_id);

-- A parent must belong to the same post as the child reply. That's a
-- cross-row check a column constraint can't express, so it's enforced in
-- thoughts/actions.ts before insert instead.
