-- Adds 'bulletin_message' for requestBulletinMessage (see thoughts/actions.ts),
-- which previously went through requestConversation without ever notifying
-- the post's author -- that path only sent 'listing_interest', and only for
-- origin_type 'listing'.
alter table notifications drop constraint notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
    'listing_interest',
    'friend_request',
    'friend_request_accepted',
    'bulletin_reply',
    'bulletin_message',
    'exchange_cancelled',
    'exchange_complete_review_prompt'
));
