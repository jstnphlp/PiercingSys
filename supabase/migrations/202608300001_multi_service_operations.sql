-- Multi-service appointments and appointment-linked draft sales.

create table public.booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  service_id uuid not null references public.services,
  position smallint not null check (position > 0),
  name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer check (price_cents is null or price_cents >= 0),
  min_price_cents integer check (min_price_cents is null or min_price_cents >= 0),
  max_price_cents integer check (max_price_cents is null or max_price_cents >= 0),
  price_unit text,
  created_at timestamptz not null default now(),
  unique (booking_id, position),
  unique (booking_id, service_id),
  check (
    (price_cents is not null and min_price_cents is null and max_price_cents is null)
    or
    (price_cents is null and min_price_cents is not null and max_price_cents is not null and min_price_cents <= max_price_cents)
  )
);

insert into public.booking_services (
  booking_id, service_id, position, name, duration_minutes,
  price_cents, min_price_cents, max_price_cents, price_unit
)
select
  b.id, s.id, 1, s.name, s.duration_minutes,
  s.price_cents, s.min_price_cents, s.max_price_cents, s.price_unit
from public.bookings b
join public.services s on s.id = b.service_id;

alter table public.bookings drop column service_id;

alter table public.sales
  add constraint sales_booking_unique unique (booking_id);

alter table public.sale_items
  alter column unit_price_cents drop not null,
  add column booking_service_id uuid references public.booking_services,
  add column min_price_cents integer check (min_price_cents is null or min_price_cents >= 0),
  add column max_price_cents integer check (max_price_cents is null or max_price_cents >= 0),
  add constraint sale_items_price_resolution_check check (
    unit_price_cents is not null
    or (min_price_cents is not null and max_price_cents is not null and min_price_cents <= max_price_cents)
  );

create unique index sale_items_booking_service_unique
  on public.sale_items (sale_id, booking_service_id)
  where booking_service_id is not null;

alter table public.booking_services enable row level security;
create policy permitted_booking_service_read on public.booking_services
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and public.can_access_booking(b.assigned_piercer_id)
    )
  );
create policy management_manage_booking_services on public.booking_services
  for all to authenticated
  using (public.is_management()) with check (public.is_management());

create or replace function public.create_public_booking(
  p_service_ids uuid[], p_starts_at timestamptz, p_preferred_piercer_id uuid,
  p_first_name text, p_last_name text, p_email text, p_phone text, p_notes text
) returns table (id uuid, reference text, status public.booking_status, starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  studio public.studio_settings%rowtype;
  selected_piercer uuid;
  calculated_end timestamptz;
  duration_minutes integer;
  service_count integer;
  local_start timestamp;
  local_date date;
  local_time time;
  local_end_time time;
  local_weekday integer;
  hours jsonb;
  customer uuid;
  created_booking public.bookings%rowtype;
begin
  if p_service_ids is null or cardinality(p_service_ids) = 0
     or cardinality(p_service_ids) <> (select count(distinct item) from unnest(p_service_ids) item) then
    raise exception using errcode = '22023', message = 'invalid_services';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_starts_at::text));
  select * into studio from public.studio_settings where studio_settings.id = 1;
  select count(*), sum(s.duration_minutes)::integer
    into service_count, duration_minutes
    from public.services s where s.id = any(p_service_ids) and s.is_active;
  if service_count <> cardinality(p_service_ids) then
    raise exception using errcode = 'P0002', message = 'service_unavailable';
  end if;
  if studio.business_hours = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'booking_not_configured';
  end if;
  if p_starts_at < now() + make_interval(hours => studio.minimum_lead_hours)
     or p_starts_at > now() + make_interval(days => studio.booking_horizon_days) then
    raise exception using errcode = '22007', message = 'slot_outside_booking_window';
  end if;

  calculated_end := p_starts_at + make_interval(mins => duration_minutes);
  local_start := p_starts_at at time zone 'Asia/Manila';
  local_date := local_start::date;
  local_time := local_start::time;
  local_end_time := calculated_end at time zone 'Asia/Manila';
  local_weekday := extract(dow from local_date);
  hours := studio.business_hours -> local_weekday::text;
  if hours is null or coalesce((hours ->> 'closed')::boolean, false)
     or local_time < (hours ->> 'open')::time
     or local_end_time > (hours ->> 'close')::time
     or (calculated_end at time zone 'Asia/Manila')::date <> local_date then
    raise exception using errcode = '22007', message = 'outside_business_hours';
  end if;
  if exists (
    select 1 from public.closures c
    where p_starts_at < c.ends_at and calculated_end > c.starts_at
  ) then
    raise exception using errcode = '23P01', message = 'slot_unavailable';
  end if;

  select sp.user_id into selected_piercer
    from public.staff_profiles sp
    join public.staff_availability sa
      on sa.staff_id = sp.user_id and sa.weekday = local_weekday
   where sp.active and sp.role = 'piercer'
     and (p_preferred_piercer_id is null or sp.user_id = p_preferred_piercer_id)
     and local_time >= sa.starts_at and local_end_time <= sa.ends_at
     and not exists (
       select 1 from unnest(p_service_ids) requested(service_id)
       where not exists (
         select 1 from public.service_staff ss
         where ss.staff_id = sp.user_id and ss.service_id = requested.service_id
       )
     )
     and not exists (
       select 1 from public.bookings b
       where b.assigned_piercer_id = sp.user_id
         and b.status in ('confirmed', 'completed', 'no_show')
         and p_starts_at < b.ends_at and calculated_end > b.starts_at
     )
   order by sp.created_at limit 1;
  if selected_piercer is null then
    raise exception using errcode = '23P01', message = 'slot_unavailable';
  end if;

  select c.id into customer from public.customers c
   where lower(c.email) = lower(trim(p_email)) and c.phone = trim(p_phone)
   order by c.created_at limit 1;
  if customer is null then
    insert into public.customers (first_name, last_name, email, phone)
    values (trim(p_first_name), trim(p_last_name), lower(trim(p_email)), trim(p_phone))
    returning customers.id into customer;
  else
    update public.customers
       set first_name = trim(p_first_name), last_name = trim(p_last_name), updated_at = now()
     where customers.id = customer;
  end if;

  insert into public.bookings (
    customer_id, assigned_piercer_id, status, starts_at, ends_at, notes
  ) values (
    customer, selected_piercer, 'confirmed', p_starts_at, calculated_end, nullif(trim(p_notes), '')
  ) returning * into created_booking;

  insert into public.booking_services (
    booking_id, service_id, position, name, duration_minutes,
    price_cents, min_price_cents, max_price_cents, price_unit
  )
  select created_booking.id, s.id, requested.ordinality, s.name, s.duration_minutes,
         s.price_cents, s.min_price_cents, s.max_price_cents, s.price_unit
    from unnest(p_service_ids) with ordinality requested(service_id, ordinality)
    join public.services s on s.id = requested.service_id
   order by requested.ordinality;

  insert into public.notification_deliveries (booking_id, kind, recipient, idempotency_key)
  values (created_booking.id, 'confirmation', lower(trim(p_email)), created_booking.id::text || ':confirmation');
  return query select created_booking.id, created_booking.reference, created_booking.status,
                      created_booking.starts_at, created_booking.ends_at;
end;
$$;

revoke all on function public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text) to service_role;

-- Legacy single-service callers remain valid during the client rollout.
create or replace function public.create_public_booking(
  p_service_id uuid, p_starts_at timestamptz, p_preferred_piercer_id uuid,
  p_first_name text, p_last_name text, p_email text, p_phone text, p_notes text
) returns table (id uuid, reference text, status public.booking_status, starts_at timestamptz, ends_at timestamptz)
language sql security definer set search_path = '' as $$
  select * from public.create_public_booking(
    array[p_service_id], p_starts_at, p_preferred_piercer_id,
    p_first_name, p_last_name, p_email, p_phone, p_notes
  );
$$;

create or replace function public.create_staff_booking(
  p_service_ids uuid[], p_starts_at timestamptz, p_piercer_id uuid, p_station_id uuid,
  p_customer_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text,
  p_notes text, p_send_confirmation boolean default true
) returns table (id uuid, reference text, status public.booking_status, starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.staff_role;
  studio public.studio_settings%rowtype;
  calculated_end timestamptz;
  duration_minutes integer;
  service_count integer;
  local_start timestamp;
  local_date date;
  local_time time;
  local_end_time time;
  local_weekday integer;
  hours jsonb;
  customer uuid;
  customer_email text;
  created_booking public.bookings%rowtype;
begin
  actor_role := public.current_staff_role();
  if actor_role is null then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  if actor_role = 'piercer' and p_piercer_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'piercer_self_assignment_required';
  end if;
  if p_service_ids is null or cardinality(p_service_ids) = 0
     or cardinality(p_service_ids) <> (select count(distinct item) from unnest(p_service_ids) item) then
    raise exception using errcode = '22023', message = 'invalid_services';
  end if;

  select * into studio from public.studio_settings where studio_settings.id = 1;
  select count(*), sum(s.duration_minutes)::integer into service_count, duration_minutes
    from public.services s where s.id = any(p_service_ids) and s.is_active;
  if service_count <> cardinality(p_service_ids) then
    raise exception using errcode = 'P0002', message = 'service_unavailable';
  end if;
  if not exists (
    select 1 from public.staff_profiles sp
     where sp.user_id = p_piercer_id and sp.active and sp.role = 'piercer'
  ) or exists (
    select 1 from unnest(p_service_ids) requested(service_id)
     where not exists (
       select 1 from public.service_staff ss
        where ss.staff_id = p_piercer_id and ss.service_id = requested.service_id
     )
  ) then raise exception using errcode = '22023', message = 'piercer_not_qualified'; end if;

  perform pg_advisory_xact_lock(hashtext(p_piercer_id::text || p_starts_at::text));
  calculated_end := p_starts_at + make_interval(mins => duration_minutes);
  local_start := p_starts_at at time zone 'Asia/Manila';
  local_date := local_start::date;
  local_time := local_start::time;
  local_end_time := calculated_end at time zone 'Asia/Manila';
  local_weekday := extract(dow from local_date);
  hours := studio.business_hours -> local_weekday::text;
  if hours is null or coalesce((hours ->> 'closed')::boolean, false)
     or local_time < (hours ->> 'open')::time or local_end_time > (hours ->> 'close')::time
     or (calculated_end at time zone 'Asia/Manila')::date <> local_date then
    raise exception using errcode = '22007', message = 'outside_business_hours';
  end if;
  if not exists (
    select 1 from public.staff_availability sa
     where sa.staff_id = p_piercer_id and sa.weekday = local_weekday
       and local_time >= sa.starts_at and local_end_time <= sa.ends_at
  ) then raise exception using errcode = '22007', message = 'outside_staff_availability'; end if;
  if exists (
    select 1 from public.closures c where p_starts_at < c.ends_at and calculated_end > c.starts_at
  ) or exists (
    select 1 from public.bookings b where b.assigned_piercer_id = p_piercer_id
      and b.status in ('confirmed', 'completed', 'no_show')
      and p_starts_at < b.ends_at and calculated_end > b.starts_at
  ) or (p_station_id is not null and exists (
    select 1 from public.bookings b where b.station_id = p_station_id
      and b.status in ('confirmed', 'completed', 'no_show')
      and p_starts_at < b.ends_at and calculated_end > b.starts_at
  )) then raise exception using errcode = '23P01', message = 'slot_unavailable'; end if;

  if p_customer_id is not null then
    select c.id, c.email into customer, customer_email from public.customers c where c.id = p_customer_id;
    if customer is null then raise exception using errcode = 'P0002', message = 'customer_not_found'; end if;
  else
    if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null
       or nullif(trim(p_email), '') is null or nullif(trim(p_phone), '') is null then
      raise exception using errcode = '22023', message = 'customer_details_required';
    end if;
    select c.id into customer from public.customers c
      where lower(c.email) = lower(trim(p_email)) and c.phone = trim(p_phone)
      order by c.created_at limit 1;
    if customer is null then
      insert into public.customers (first_name, last_name, email, phone)
      values (trim(p_first_name), trim(p_last_name), lower(trim(p_email)), trim(p_phone))
      returning customers.id into customer;
    end if;
    customer_email := lower(trim(p_email));
  end if;

  insert into public.bookings (
    customer_id, assigned_piercer_id, station_id, status, starts_at, ends_at, notes
  ) values (
    customer, p_piercer_id, p_station_id, 'confirmed', p_starts_at, calculated_end, nullif(trim(p_notes), '')
  ) returning * into created_booking;

  insert into public.booking_services (
    booking_id, service_id, position, name, duration_minutes,
    price_cents, min_price_cents, max_price_cents, price_unit
  )
  select created_booking.id, s.id, requested.ordinality, s.name, s.duration_minutes,
         s.price_cents, s.min_price_cents, s.max_price_cents, s.price_unit
    from unnest(p_service_ids) with ordinality requested(service_id, ordinality)
    join public.services s on s.id = requested.service_id order by requested.ordinality;

  if p_send_confirmation and customer_email is not null then
    insert into public.notification_deliveries (booking_id, kind, recipient, idempotency_key)
    values (created_booking.id, 'confirmation', customer_email, created_booking.id::text || ':confirmation');
  end if;
  return query select created_booking.id, created_booking.reference, created_booking.status,
                      created_booking.starts_at, created_booking.ends_at;
end;
$$;
revoke all on function public.create_staff_booking(uuid[],timestamptz,uuid,uuid,uuid,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.create_staff_booking(uuid[],timestamptz,uuid,uuid,uuid,text,text,text,text,text,boolean) to authenticated;

create or replace function public.reschedule_booking(
  p_booking_id uuid, p_starts_at timestamptz, p_piercer_id uuid, p_station_id uuid
) returns table (starts_at timestamptz, ends_at timestamptz, assigned_piercer_id uuid, station_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.staff_role;
  target public.bookings%rowtype;
  studio public.studio_settings%rowtype;
  duration_minutes integer;
  calculated_end timestamptz;
  local_start timestamp;
  local_date date;
  local_time time;
  local_end_time time;
  local_weekday integer;
  hours jsonb;
begin
  actor_role := public.current_staff_role();
  select * into target from public.bookings b where b.id = p_booking_id;
  if target.id is null or actor_role is null then raise exception using errcode = 'P0002', message = 'booking_not_found'; end if;
  if actor_role = 'piercer' and (target.assigned_piercer_id <> auth.uid() or p_piercer_id <> auth.uid()) then
    raise exception using errcode = '42501', message = 'piercer_self_assignment_required';
  end if;
  if target.status not in ('requested', 'confirmed') then
    raise exception using errcode = '22023', message = 'booking_cannot_be_rescheduled';
  end if;
  select sum(bs.duration_minutes)::integer into duration_minutes
    from public.booking_services bs where bs.booking_id = p_booking_id;
  if duration_minutes is null then raise exception using errcode = '22023', message = 'booking_has_no_services'; end if;
  if not exists (
    select 1 from public.staff_profiles sp where sp.user_id = p_piercer_id and sp.active and sp.role = 'piercer'
  ) or exists (
    select 1 from public.booking_services bs where bs.booking_id = p_booking_id
      and not exists (
        select 1 from public.service_staff ss
         where ss.staff_id = p_piercer_id and ss.service_id = bs.service_id
      )
  ) then raise exception using errcode = '22023', message = 'piercer_not_qualified'; end if;

  select * into studio from public.studio_settings where studio_settings.id = 1;
  calculated_end := p_starts_at + make_interval(mins => duration_minutes);
  local_start := p_starts_at at time zone 'Asia/Manila';
  local_date := local_start::date;
  local_time := local_start::time;
  local_end_time := calculated_end at time zone 'Asia/Manila';
  local_weekday := extract(dow from local_date);
  hours := studio.business_hours -> local_weekday::text;
  if hours is null or coalesce((hours ->> 'closed')::boolean, false)
     or local_time < (hours ->> 'open')::time or local_end_time > (hours ->> 'close')::time
     or (calculated_end at time zone 'Asia/Manila')::date <> local_date then
    raise exception using errcode = '22007', message = 'outside_business_hours';
  end if;
  if not exists (
    select 1 from public.staff_availability sa
     where sa.staff_id = p_piercer_id and sa.weekday = local_weekday
       and local_time >= sa.starts_at and local_end_time <= sa.ends_at
  ) then raise exception using errcode = '22007', message = 'outside_staff_availability'; end if;
  if exists (
    select 1 from public.closures c where p_starts_at < c.ends_at and calculated_end > c.starts_at
  ) or exists (
    select 1 from public.bookings b where b.id <> p_booking_id and b.assigned_piercer_id = p_piercer_id
      and b.status in ('confirmed', 'completed', 'no_show')
      and p_starts_at < b.ends_at and calculated_end > b.starts_at
  ) or (p_station_id is not null and exists (
    select 1 from public.bookings b where b.id <> p_booking_id and b.station_id = p_station_id
      and b.status in ('confirmed', 'completed', 'no_show')
      and p_starts_at < b.ends_at and calculated_end > b.starts_at
  )) then raise exception using errcode = '23P01', message = 'slot_unavailable'; end if;

  update public.bookings b set starts_at = p_starts_at, ends_at = calculated_end,
    assigned_piercer_id = p_piercer_id, station_id = p_station_id, updated_at = now()
    where b.id = p_booking_id;
  return query select p_starts_at, calculated_end, p_piercer_id, p_station_id;
end;
$$;
revoke all on function public.reschedule_booking(uuid,timestamptz,uuid,uuid) from public, anon;
grant execute on function public.reschedule_booking(uuid,timestamptz,uuid,uuid) to authenticated;

create or replace function public.complete_booking_and_create_sale(p_booking_id uuid)
returns table (booking_id uuid, sale_id uuid, sale_reference text)
language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.staff_role;
  target public.bookings%rowtype;
  target_sale public.sales%rowtype;
  subtotal integer;
begin
  actor_role := public.current_staff_role();
  select * into target from public.bookings b where b.id = p_booking_id for update;
  if target.id is null or actor_role is null then raise exception using errcode = 'P0002', message = 'booking_not_found'; end if;
  if actor_role = 'piercer' and target.assigned_piercer_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if target.status not in ('confirmed', 'completed') then
    raise exception using errcode = '22023', message = 'booking_cannot_be_completed';
  end if;
  update public.bookings set status = 'completed', updated_at = now()
    where id = p_booking_id and status = 'confirmed';

  insert into public.sales (booking_id, customer_id, status)
  values (p_booking_id, target.customer_id, 'draft')
  on conflict on constraint sales_booking_unique do nothing;
  select * into target_sale from public.sales s where s.booking_id = p_booking_id;
  if target_sale.status <> 'draft' then
    return query select p_booking_id, target_sale.id, target_sale.reference;
    return;
  end if;

  insert into public.sale_items (
    sale_id, item_type, source_id, booking_service_id, description, quantity,
    unit_price_cents, min_price_cents, max_price_cents, discount_cents
  )
  select target_sale.id, 'service', bs.service_id, bs.id, bs.name, 1,
         bs.price_cents, bs.min_price_cents, bs.max_price_cents, 0
    from public.booking_services bs where bs.booking_id = p_booking_id
  on conflict do nothing;

  select coalesce(sum(si.quantity * si.unit_price_cents - si.discount_cents), 0)::integer
    into subtotal from public.sale_items si where si.sale_id = target_sale.id;
  update public.sales set subtotal_cents = subtotal,
    total_cents = greatest(0, subtotal - discount_cents), updated_at = now()
    where id = target_sale.id;
  return query select p_booking_id, target_sale.id, target_sale.reference;
end;
$$;
revoke all on function public.complete_booking_and_create_sale(uuid) from public, anon;
grant execute on function public.complete_booking_and_create_sale(uuid) to authenticated;

create or replace function public.complete_draft_sale(p_sale_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.sales%rowtype;
  paid integer;
begin
  if not public.is_management() then raise exception using errcode = '42501', message = 'not_authorized'; end if;
  select * into target from public.sales s where s.id = p_sale_id for update;
  if target.id is null or target.status <> 'draft' then
    raise exception using errcode = '22023', message = 'sale_not_draft';
  end if;
  if exists (select 1 from public.sale_items si where si.sale_id = p_sale_id and si.unit_price_cents is null) then
    raise exception using errcode = '22023', message = 'pricing_required';
  end if;
  select coalesce(sum(p.amount_cents), 0)::integer into paid from public.payments p where p.sale_id = p_sale_id;
  if paid < target.total_cents then raise exception using errcode = '22023', message = 'balance_due'; end if;
  update public.sales set status = 'completed', completed_at = now(), completed_by = auth.uid(), updated_at = now()
   where id = p_sale_id;
end;
$$;
revoke all on function public.complete_draft_sale(uuid) from public, anon;
grant execute on function public.complete_draft_sale(uuid) to authenticated;

create or replace function public.recalculate_draft_sale()
returns trigger language plpgsql set search_path = '' as $$
declare target_sale uuid;
begin
  target_sale := case when tg_op = 'DELETE' then old.sale_id else new.sale_id end;
  update public.sales s set
    subtotal_cents = totals.subtotal,
    total_cents = greatest(0, totals.subtotal - s.discount_cents),
    updated_at = now()
  from (
    select coalesce(sum(si.quantity * si.unit_price_cents - si.discount_cents), 0)::integer subtotal
    from public.sale_items si where si.sale_id = target_sale
  ) totals
  where s.id = target_sale and s.status = 'draft';
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger recalculate_draft_sale_totals
after insert or update or delete on public.sale_items
for each row execute function public.recalculate_draft_sale();
