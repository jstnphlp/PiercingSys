-- Stable staff configuration is loaded together so a cold Next.js cache fill
-- needs one Supabase request instead of seven independent HTTP round trips.
create or replace function public.staff_reference_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'studio', (
      select to_jsonb(studio)
      from public.studio_settings studio
      where studio.id = 1
    ),
    'services', coalesce((
      select jsonb_agg(to_jsonb(service) order by service.sort_order)
      from public.services service
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(to_jsonb(person) order by person.created_at)
      from public.staff_profiles person
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(assignment))
      from public.service_staff assignment
    ), '[]'::jsonb),
    'stations', coalesce((
      select jsonb_agg(to_jsonb(station) order by station.name)
      from public.stations station
      where station.active
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(to_jsonb(slot) order by slot.weekday, slot.starts_at)
      from public.staff_availability slot
    ), '[]'::jsonb),
    'closures', coalesce((
      select jsonb_agg(to_jsonb(recent_closure) order by recent_closure.starts_at desc)
      from (
        select closure.*
        from public.closures closure
        order by closure.starts_at desc
        limit 100
      ) recent_closure
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.staff_reference_data() from public;
revoke all on function public.staff_reference_data() from anon;
revoke all on function public.staff_reference_data() from authenticated;
grant execute on function public.staff_reference_data() to service_role;
