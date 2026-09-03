-- The demo/default studio day uses the displayed 11:59 PM label, which the
-- scheduling layer interprets as the exclusive midnight endpoint. Restrict
-- this upgrade to the seeded 8 PM values so configured custom schedules stay
-- untouched.
update public.studio_settings
set business_hours = (
  select jsonb_object_agg(
    weekday,
    case when hours ->> 'close' = '20:00'
      then jsonb_set(hours, '{close}', '"23:59"'::jsonb)
      else hours
    end
  )
  from jsonb_each(business_hours) as schedule(weekday, hours)
), updated_at = now()
where id = 1
  and exists (
    select 1 from jsonb_each(business_hours) as schedule(weekday, hours)
    where hours ->> 'close' = '20:00'
  );

update public.staff_availability
set ends_at = time '23:59'
where ends_at = time '20:00';
