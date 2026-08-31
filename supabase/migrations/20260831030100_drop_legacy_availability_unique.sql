-- Some deployed databases retained the original availability uniqueness rule
-- as a standalone index rather than a table constraint. It must be removed so
-- dated blocks on different weeks can share the same weekday and hours.
drop index if exists public.staff_availability_staff_id_weekday_starts_at_ends_at_key;
