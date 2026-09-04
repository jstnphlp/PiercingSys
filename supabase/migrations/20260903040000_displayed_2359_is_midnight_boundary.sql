-- 11:59 PM is the calendar's displayed final label, not a one-minute-short
-- scheduling cutoff. Normalize only end boundaries to PostgreSQL's 24:00.
do $$
declare
  procedure_name regprocedure;
  definition text;
  close_boundary constant text :=
    '(local_date + (hours ->> ''close'')::time) at time zone ''Asia/Manila''';
  close_replacement constant text :=
    '(local_date + case when hours ->> ''close'' = ''23:59'' then time ''24:00'' else (hours ->> ''close'')::time end) at time zone ''Asia/Manila''';
  availability_boundary constant text :=
    '(local_date + sa.ends_at) at time zone ''Asia/Manila''';
  availability_replacement constant text :=
    '(local_date + case when sa.ends_at = time ''23:59'' then time ''24:00'' else sa.ends_at end) at time zone ''Asia/Manila''';
begin
  foreach procedure_name in array array[
    'public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text,text)'::regprocedure,
    'public.create_staff_booking(uuid[],timestamptz,uuid,uuid,uuid,text,text,text,text,text,boolean)'::regprocedure,
    'public.reschedule_booking(uuid,timestamptz,uuid,uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(procedure_name) into definition;
    if position(close_boundary in definition) = 0
       or position(availability_boundary in definition) = 0 then
      raise exception '% no longer has the expected scheduling end boundaries', procedure_name;
    end if;
    execute replace(
      replace(definition, close_boundary, close_replacement),
      availability_boundary,
      availability_replacement
    );
  end loop;

  select pg_get_functiondef('public.available_slots(uuid[],date,date,uuid,boolean)'::regprocedure)
    into definition;
  if position('(days.day + (h.hours ->> ''close'')::time) at time zone ''Asia/Manila''' in definition) = 0
     or position('(days.day + sa.ends_at) at time zone ''Asia/Manila''' in definition) = 0 then
    raise exception 'available_slots no longer has the expected scheduling end boundaries';
  end if;
  execute replace(
    replace(
      definition,
      '(days.day + (h.hours ->> ''close'')::time) at time zone ''Asia/Manila''',
      '(days.day + case when h.hours ->> ''close'' = ''23:59'' then time ''24:00'' else (h.hours ->> ''close'')::time end) at time zone ''Asia/Manila'''
    ),
    '(days.day + sa.ends_at) at time zone ''Asia/Manila''',
    '(days.day + case when sa.ends_at = time ''23:59'' then time ''24:00'' else sa.ends_at end) at time zone ''Asia/Manila'''
  );
end;
$$;
