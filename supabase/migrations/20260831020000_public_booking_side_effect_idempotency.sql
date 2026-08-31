-- Report whether an idempotent public-booking request created a booking so
-- application side effects are only queued by the winning request.
create or replace function public.create_public_booking_with_result(
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_preferred_piercer_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_idempotency_key text
) returns table (
  id uuid,
  reference text,
  status public.booking_status,
  starts_at timestamptz,
  ends_at timestamptz,
  was_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_booking public.bookings%rowtype;
  key text;
begin
  key := nullif(trim(coalesce(p_idempotency_key, '')), '');
  if key is not null then
    perform pg_advisory_xact_lock(hashtext('booking-key:' || key));
    select b.* into existing_booking
      from public.public_booking_keys k
      join public.bookings b on b.id = k.booking_id
     where k.idempotency_key = key;
    if found then
      return query select existing_booking.id, existing_booking.reference,
                          existing_booking.status, existing_booking.starts_at,
                          existing_booking.ends_at, false;
      return;
    end if;
  end if;

  return query
    select booking.id, booking.reference, booking.status, booking.starts_at,
           booking.ends_at, true
      from public.create_public_booking(
        p_service_ids, p_starts_at, p_preferred_piercer_id,
        p_first_name, p_last_name, p_email, p_phone, p_notes, key
      ) booking;
end;
$$;

revoke all on function public.create_public_booking_with_result(uuid[],timestamptz,uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_public_booking_with_result(uuid[],timestamptz,uuid,text,text,text,text,text,text)
  to service_role;
