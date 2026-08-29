create or replace function public.require_booking_services()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.booking_services bs where bs.booking_id = new.id) then
    raise exception using errcode = '23514', message = 'booking_requires_service';
  end if;
  return null;
end;
$$;
create constraint trigger booking_requires_service
after insert on public.bookings deferrable initially deferred
for each row execute function public.require_booking_services();

create or replace function public.require_active_booking_station()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.station_id is not null and not exists (
    select 1 from public.stations s where s.id = new.station_id and s.active
  ) then
    raise exception using errcode = '23514', message = 'station_unavailable';
  end if;
  return new;
end;
$$;
create trigger booking_station_must_be_active
before insert or update of station_id on public.bookings
for each row execute function public.require_active_booking_station();
