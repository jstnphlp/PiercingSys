-- Support one-off and ranged staff availability while preserving legacy
-- weekday-recurring blocks. A date range is stored as one row per date so
-- each generated block can be edited or removed independently.
alter table public.staff_availability
  add column if not exists availability_date date;

alter table public.staff_availability
  drop constraint if exists staff_availability_staff_id_weekday_starts_at_ends_at_key;

create unique index if not exists staff_availability_recurring_unique
  on public.staff_availability (staff_id, weekday, starts_at, ends_at)
  where availability_date is null;

create unique index if not exists staff_availability_dated_unique
  on public.staff_availability (staff_id, availability_date, starts_at, ends_at)
  where availability_date is not null;

create index if not exists staff_availability_date_idx
  on public.staff_availability (availability_date, staff_id)
  where availability_date is not null;

-- Patch the four availability-aware booking functions defined by earlier
-- migrations. Assertions make the migration fail atomically if those
-- definitions ever diverge instead of silently leaving dated rows recurring.
do $$
declare
  definition text;
  recurring_match constant text := 'sa.weekday = local_weekday';
  dated_match constant text := '(sa.availability_date = local_date or (sa.availability_date is null and sa.weekday = local_weekday))';
  range_match constant text := 'sa.weekday = extract(dow from days.day)::integer';
  dated_range_match constant text := '(sa.availability_date = days.day or (sa.availability_date is null and sa.weekday = extract(dow from days.day)::integer))';
begin
  select pg_get_functiondef('public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text,text)'::regprocedure)
    into definition;
  if position(recurring_match in definition) = 0 then
    raise exception 'create_public_booking availability predicate was not found';
  end if;
  execute replace(definition, recurring_match, dated_match);

  select pg_get_functiondef('public.create_staff_booking(uuid[],timestamptz,uuid,uuid,uuid,text,text,text,text,text,boolean)'::regprocedure)
    into definition;
  if position(recurring_match in definition) = 0 then
    raise exception 'create_staff_booking availability predicate was not found';
  end if;
  execute replace(definition, recurring_match, dated_match);

  select pg_get_functiondef('public.reschedule_booking(uuid,timestamptz,uuid,uuid)'::regprocedure)
    into definition;
  if position(recurring_match in definition) = 0 then
    raise exception 'reschedule_booking availability predicate was not found';
  end if;
  execute replace(definition, recurring_match, dated_match);

  select pg_get_functiondef('public.available_slots(uuid[],date,date,uuid,boolean)'::regprocedure)
    into definition;
  if position(range_match in definition) = 0 then
    raise exception 'available_slots availability predicate was not found';
  end if;
  execute replace(definition, range_match, dated_range_match);
end;
$$;

comment on column public.staff_availability.availability_date is
  'Specific Manila calendar date for a one-off block; null means the block recurs by weekday.';
