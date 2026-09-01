-- Keep advertised starts within the same exact booking-horizon cutoff enforced
-- by create_public_booking. The prior day-level check could expose late slots
-- on the final horizon date that confirmation would reject.
create or replace function public.available_slots(
  p_service_ids uuid[],
  p_from date,
  p_to date,
  p_piercer_id uuid default null,
  p_enforce_booking_window boolean default true
) returns table (starts_at timestamptz, ends_at timestamptz, piercer_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  studio public.studio_settings%rowtype;
  duration_minutes integer;
  service_count integer;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 14 then
    raise exception using errcode = '22023', message = 'invalid_date_range';
  end if;
  if p_service_ids is null or cardinality(p_service_ids) = 0
     or cardinality(p_service_ids) <> (select count(distinct item) from unnest(p_service_ids) item) then
    raise exception using errcode = '22023', message = 'invalid_services';
  end if;

  select * into studio from public.studio_settings where studio_settings.id = 1;
  if studio.id is null or studio.business_hours = '{}'::jsonb then
    return;
  end if;

  select count(*), coalesce(sum(s.duration_minutes), 0)::integer
    into service_count, duration_minutes
    from public.services s
   where s.id = any(p_service_ids) and s.is_active;
  if service_count <> cardinality(p_service_ids) or duration_minutes <= 0 then
    return;
  end if;

  return query
  with days as (
    select g.day::date as day
    from generate_series(p_from, p_to, interval '1 day') as g(day)
  ),
  qualified as (
    select sp.user_id
    from public.staff_profiles sp
    where sp.active and sp.role = 'piercer'
      and (p_piercer_id is null or sp.user_id = p_piercer_id)
      and not exists (
        select 1 from unnest(p_service_ids) req(service_id)
        where not exists (
          select 1 from public.service_staff ss
          where ss.staff_id = sp.user_id and ss.service_id = req.service_id
        )
      )
  ),
  windows as (
    select
      q.user_id as piercer_id,
      greatest(
        (days.day + (h.hours ->> 'open')::time) at time zone 'Asia/Manila',
        (days.day + sa.starts_at) at time zone 'Asia/Manila'
      ) as opens,
      least(
        (days.day + (h.hours ->> 'close')::time) at time zone 'Asia/Manila',
        (days.day + sa.ends_at) at time zone 'Asia/Manila'
      ) as closes
    from days
    join qualified q on true
    join public.staff_availability sa
      on sa.staff_id = q.user_id
     and sa.weekday = extract(dow from days.day)::integer
    cross join lateral (
      select studio.business_hours -> ((extract(dow from days.day)::integer)::text) as hours
    ) h
    where h.hours is not null
      and coalesce((h.hours ->> 'closed')::boolean, false) is not true
      and (
        not p_enforce_booking_window
        or (
          days.day >= (now() at time zone 'Asia/Manila')::date
          and (days.day::timestamp) at time zone 'Asia/Manila'
              <= now() + make_interval(days => studio.booking_horizon_days)
        )
      )
  ),
  candidates as (
    select
      w.piercer_id,
      slot_start,
      slot_start + make_interval(mins => duration_minutes) as slot_end
    from windows w
    cross join lateral generate_series(
      w.opens,
      w.closes - make_interval(mins => duration_minutes),
      make_interval(mins => studio.booking_interval_minutes)
    ) as gs(slot_start)
    where slot_start + make_interval(mins => duration_minutes) <= w.closes
      and (
        not p_enforce_booking_window
        or (
          slot_start >= now() + make_interval(hours => studio.minimum_lead_hours)
          and slot_start <= now() + make_interval(days => studio.booking_horizon_days)
        )
      )
  )
  select c.slot_start, c.slot_end, array_agg(c.piercer_id order by c.piercer_id)
  from candidates c
  where not exists (
    select 1 from public.closures cl
    where c.slot_start < cl.ends_at and c.slot_end > cl.starts_at
  )
  and not exists (
    select 1 from public.bookings b
    where b.assigned_piercer_id = c.piercer_id
      and b.status not in ('cancelled', 'rejected')
      and c.slot_start < b.ends_at and c.slot_end > b.starts_at
  )
  group by c.slot_start, c.slot_end
  order by c.slot_start;
end;
$$;

revoke all on function public.available_slots(uuid[], date, date, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.available_slots(uuid[], date, date, uuid, boolean)
  to service_role;
