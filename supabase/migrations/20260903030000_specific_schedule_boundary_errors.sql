-- Preserve the same server-side constraints while returning actionable errors
-- to the appointment composer and public booking flow.
do $$
declare
  procedure_name regprocedure;
  definition text;
  boundary_check_inline constant text :=
    'if hours is null or coalesce((hours ->> ''closed'')::boolean, false)' || E'\n' ||
    '     or local_time < (hours ->> ''open'')::time or calculated_end > ((local_date + (hours ->> ''close'')::time) at time zone ''Asia/Manila'') then' || E'\n' ||
    '    raise exception using errcode = ''22007'', message = ''outside_business_hours'';' || E'\n' ||
    '  end if;';
  boundary_check_split constant text :=
    'if hours is null or coalesce((hours ->> ''closed'')::boolean, false)' || E'\n' ||
    '     or local_time < (hours ->> ''open'')::time' || E'\n' ||
    '     or calculated_end > ((local_date + (hours ->> ''close'')::time) at time zone ''Asia/Manila'') then' || E'\n' ||
    '    raise exception using errcode = ''22007'', message = ''outside_business_hours'';' || E'\n' ||
    '  end if;';
  boundary_replacement constant text :=
    'if hours is null or coalesce((hours ->> ''closed'')::boolean, false) then' || E'\n' ||
    '    raise exception using errcode = ''22007'', message = ''studio_closed'';' || E'\n' ||
    '  elsif local_time < (hours ->> ''open'')::time then' || E'\n' ||
    '    raise exception using errcode = ''22007'', message = ''before_studio_hours'';' || E'\n' ||
    '  elsif calculated_end > ((local_date + (hours ->> ''close'')::time) at time zone ''Asia/Manila'') then' || E'\n' ||
    '    raise exception using errcode = ''22007'', message = ''appointment_ends_after_studio_hours'';' || E'\n' ||
    '  end if;';
begin
  foreach procedure_name in array array[
    'public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text,text)'::regprocedure,
    'public.create_staff_booking(uuid[],timestamptz,uuid,uuid,uuid,text,text,text,text,text,boolean)'::regprocedure,
    'public.reschedule_booking(uuid,timestamptz,uuid,uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(procedure_name) into definition;
    if position(boundary_check_inline in definition) > 0 then
      execute replace(definition, boundary_check_inline, boundary_replacement);
    elsif position(boundary_check_split in definition) > 0 then
      execute replace(definition, boundary_check_split, boundary_replacement);
    else
      raise exception '% no longer has the expected business-hours validation', procedure_name;
    end if;
  end loop;
end;
$$;
