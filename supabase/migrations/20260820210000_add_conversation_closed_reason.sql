-- markListingFulfilled, markListingReturned, and unreserveListing all close
-- a conversation ('status' -> 'closed') once its transaction is decided one
-- way or another, but they use the exact same listing status values to get
-- there in different combinations -- e.g. a completed lend return (relist)
-- and a cancelled reservation ("didn't work out") both leave the listing at
-- status 'active' and the conversation 'closed'. There is no way to tell
-- those two apart from listing/conversation status alone, which the review
-- page (app/(beta-app)/review/[conversationId]/page.tsx) needs to do to
-- decide whether an exchange is actually review-eligible. closed_reason
-- records that intent directly on the conversation instead.
alter table conversations
    add column if not exists closed_reason text
    check (closed_reason in ('fulfilled', 'cancelled'));
