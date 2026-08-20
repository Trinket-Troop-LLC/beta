-- Plain participant-initiated closes (e.g. ending a bulletin-originated DM
-- thread with no listing attached) aren't a deal falling through
-- ('cancelled') or completing ('fulfilled') -- they're just done. 'closed'
-- covers that case without disturbing the review-eligibility meaning the
-- other two values already carry (see 20260820210000's comment).
alter table conversations
    drop constraint conversations_closed_reason_check;

alter table conversations
    add constraint conversations_closed_reason_check
    check (closed_reason in ('fulfilled', 'cancelled', 'closed'));
