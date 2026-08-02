alter table public.general_interest
    rename column friend_emails to friend_phone_numbers;

alter table public.general_interest
    drop constraint if exists general_interest_friend_emails_check;

alter table public.general_interest
    add constraint general_interest_friend_phone_numbers_check
        check (
            cardinality(friend_phone_numbers) <= 20
            and char_length(array_to_string(friend_phone_numbers, ',')) <= 2000
        );
