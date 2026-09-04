-- Midnight is the exclusive endpoint of a Manila business day. PostgreSQL's
-- `time '24:00'` preserves that endpoint without turning it into 23:59.
-- Update the availability-aware functions instead of comparing only clock
-- times: an endpoint at 00:00 on the next date is valid precisely when it is
-- equal to this date's configured 24:00 boundary.
do $$
declare
  procedure_name regprocedure;
  definition text;
  hours_check constant text :=
    'or local_end_time > (hours ->> ''close'')::time' || E'\n' ||
    '     or (calculated_end at time zone ''Asia/Manila'')::date <> local_date';
  hours_replacement constant text :=
    'or calculated_end > ((local_date + (hours ->> ''close'')::time) at time zone ''Asia/Manila'')';
  availability_check constant text :=
    'local_time >= sa.starts_at and local_end_time <= sa.ends_at';
  availability_replacement constant text :=
    'p_starts_at >= ((local_date + sa.starts_at) at time zone ''Asia/Manila'')' || E'\n' ||
    '       and calculated_end <= ((local_date + sa.ends_at) at time zone ''Asia/Manila'')';
begin
  foreach procedure_name in array array[
    'public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text,text)'::regprocedure,
    'public.create_staff_booking(uuid[],timestamptz,uuid,uuid,uuid,text,text,text,text,text,boolean)'::regprocedure,
    'public.reschedule_booking(uuid,timestamptz,uuid,uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(procedure_name) into definition;
    if position(hours_check in definition) = 0
       or position(availability_check in definition) = 0 then
      raise exception '% no longer has the expected Manila end-boundary checks', procedure_name;
    end if;
    execute replace(
      replace(definition, hours_check, hours_replacement),
      availability_check,
      availability_replacement
    );
  end loop;
end;
$$;
