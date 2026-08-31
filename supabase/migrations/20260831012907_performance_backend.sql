-- Indexes, cheaper RLS, range availability, atomic sales, and booking idempotency.

-- ---------------------------------------------------------------------------
-- Indexes for calendar, availability, RLS, and nested sale reads
-- ---------------------------------------------------------------------------
create index if not exists bookings_starts_at_idx
  on public.bookings (starts_at);
create index if not exists bookings_ends_at_idx
  on public.bookings (ends_at);
create index if not exists bookings_piercer_active_idx
  on public.bookings (assigned_piercer_id, starts_at)
  where status in ('confirmed', 'completed', 'no_show');
create index if not exists bookings_station_active_idx
  on public.bookings (station_id, starts_at)
  where station_id is not null and status in ('confirmed', 'completed', 'no_show');
create index if not exists bookings_customer_id_idx
  on public.bookings (customer_id);
create index if not exists bookings_status_idx
  on public.bookings (status);

create index if not exists sales_created_at_idx
  on public.sales (created_at desc);
create index if not exists sales_customer_id_idx
  on public.sales (customer_id);
create index if not exists sales_status_created_at_idx
  on public.sales (status, created_at desc);
create index if not exists payments_sale_id_idx
  on public.payments (sale_id);
create index if not exists sale_items_sale_id_idx
  on public.sale_items (sale_id);
create index if not exists sale_adjustments_sale_id_idx
  on public.sale_adjustments (sale_id);

create index if not exists closures_range_gist
  on public.closures using gist (tstzrange(starts_at, ends_at, '[)'));
create index if not exists notification_deliveries_booking_kind_idx
  on public.notification_deliveries (booking_id, kind);
create index if not exists notification_deliveries_created_at_idx
  on public.notification_deliveries (created_at desc);
create index if not exists service_staff_staff_id_idx
  on public.service_staff (staff_id);
create index if not exists booking_services_service_id_idx
  on public.booking_services (service_id);

create unique index if not exists customers_email_phone_unique
  on public.customers (lower(email), phone);

-- ---------------------------------------------------------------------------
-- RLS helpers: evaluate auth/role once per statement where the result is
-- independent of the current row.
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.staff_profiles
  where user_id = (select auth.uid()) and active
  limit 1;
$$;

create or replace function public.is_management()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.current_staff_role()) in ('owner', 'manager'), false);
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.current_staff_role()) = 'owner', false);
$$;

create or replace function public.can_access_booking(target_piercer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.is_management()), false)
      or ((select auth.uid()) = target_piercer and (select public.current_staff_role()) = 'piercer');
$$;

drop policy if exists staff_read_settings on public.studio_settings;
create policy staff_read_settings on public.studio_settings
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists management_update_settings on public.studio_settings;
create policy management_update_settings on public.studio_settings
  for update to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists staff_read_profiles on public.staff_profiles;
create policy staff_read_profiles on public.staff_profiles
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists owner_manage_profiles on public.staff_profiles;
create policy owner_manage_profiles on public.staff_profiles
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

drop policy if exists staff_read_services on public.services;
create policy staff_read_services on public.services
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists management_manage_services on public.services;
create policy management_manage_services on public.services
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists staff_read_service_assignments on public.service_staff;
create policy staff_read_service_assignments on public.service_staff
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists management_manage_service_assignments on public.service_staff;
create policy management_manage_service_assignments on public.service_staff
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists staff_read_availability on public.staff_availability;
create policy staff_read_availability on public.staff_availability
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists management_manage_availability on public.staff_availability;
create policy management_manage_availability on public.staff_availability
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists staff_read_closures on public.closures;
create policy staff_read_closures on public.closures
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists management_manage_closures on public.closures;
create policy management_manage_closures on public.closures
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists staff_read_stations on public.stations;
create policy staff_read_stations on public.stations
  for select to authenticated
  using ((select public.current_staff_role()) is not null);

drop policy if exists management_manage_stations on public.stations;
create policy management_manage_stations on public.stations
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists permitted_customer_read on public.customers;
create policy permitted_customer_read on public.customers
  for select to authenticated
  using (
    (select public.is_management())
    or exists (
      select 1 from public.bookings b
      where b.customer_id = customers.id
        and b.assigned_piercer_id = (select auth.uid())
    )
  );

drop policy if exists management_manage_customers on public.customers;
create policy management_manage_customers on public.customers
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists permitted_booking_read on public.bookings;
create policy permitted_booking_read on public.bookings
  for select to authenticated
  using (public.can_access_booking(assigned_piercer_id));

drop policy if exists management_manage_bookings on public.bookings;
create policy management_manage_bookings on public.bookings
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists piercer_update_own_bookings on public.bookings;
create policy piercer_update_own_bookings on public.bookings
  for update to authenticated
  using (
    assigned_piercer_id = (select auth.uid())
    and (select public.current_staff_role()) = 'piercer'
  )
  with check (assigned_piercer_id = (select auth.uid()));

drop policy if exists permitted_photo_read on public.booking_photos;
create policy permitted_photo_read on public.booking_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and public.can_access_booking(b.assigned_piercer_id)
    )
  );

drop policy if exists permitted_consent_read on public.consent_forms;
create policy permitted_consent_read on public.consent_forms
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and public.can_access_booking(b.assigned_piercer_id)
    )
  );

drop policy if exists management_manage_consent on public.consent_forms;
create policy management_manage_consent on public.consent_forms
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists management_manage_sales on public.sales;
create policy management_manage_sales on public.sales
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists management_manage_sale_items on public.sale_items;
create policy management_manage_sale_items on public.sale_items
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists management_manage_payments on public.payments;
create policy management_manage_payments on public.payments
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists management_manage_adjustments on public.sale_adjustments;
create policy management_manage_adjustments on public.sale_adjustments
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

drop policy if exists management_read_notifications on public.notification_deliveries;
create policy management_read_notifications on public.notification_deliveries
  for select to authenticated
  using ((select public.is_management()));

drop policy if exists management_read_audit on public.audit_events;
create policy management_read_audit on public.audit_events
  for select to authenticated
  using ((select public.is_management()));

drop policy if exists permitted_booking_service_read on public.booking_services;
create policy permitted_booking_service_read on public.booking_services
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and public.can_access_booking(b.assigned_piercer_id)
    )
  );

drop policy if exists management_manage_booking_services on public.booking_services;
create policy management_manage_booking_services on public.booking_services
  for all to authenticated
  using ((select public.is_management()))
  with check ((select public.is_management()));

-- ---------------------------------------------------------------------------
-- Public booking idempotency
-- ---------------------------------------------------------------------------
create table if not exists public.public_booking_keys (
  idempotency_key text primary key,
  booking_id uuid not null references public.bookings on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.public_booking_keys enable row level security;
revoke all on table public.public_booking_keys from public, anon, authenticated;

create or replace function public.create_public_booking(
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_preferred_piercer_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_idempotency_key text
) returns table (id uuid, reference text, status public.booking_status, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
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
  key text;
begin
  key := nullif(trim(coalesce(p_idempotency_key, '')), '');
  if key is not null then
    perform pg_advisory_xact_lock(hashtext('booking-key:' || key));
    select b.* into created_booking
      from public.public_booking_keys k
      join public.bookings b on b.id = k.booking_id
     where k.idempotency_key = key;
    if found then
      return query select created_booking.id, created_booking.reference, created_booking.status,
                          created_booking.starts_at, created_booking.ends_at;
      return;
    end if;
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0
     or cardinality(p_service_ids) <> (select count(distinct item) from unnest(p_service_ids) item) then
    raise exception using errcode = '22023', message = 'invalid_services';
  end if;

  if p_preferred_piercer_id is not null then
    perform pg_advisory_xact_lock(hashtext(p_preferred_piercer_id::text || p_starts_at::text));
  else
    perform pg_advisory_xact_lock(hashtext(p_starts_at::text));
  end if;

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

  if key is not null then
    insert into public.public_booking_keys (idempotency_key, booking_id)
    values (key, created_booking.id);
  end if;

  return query select created_booking.id, created_booking.reference, created_booking.status,
                      created_booking.starts_at, created_booking.ends_at;
end;
$$;

revoke all on function public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text,text)
  to service_role;

create or replace function public.create_public_booking(
  p_service_ids uuid[], p_starts_at timestamptz, p_preferred_piercer_id uuid,
  p_first_name text, p_last_name text, p_email text, p_phone text, p_notes text
) returns table (id uuid, reference text, status public.booking_status, starts_at timestamptz, ends_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select * from public.create_public_booking(
    p_service_ids, p_starts_at, p_preferred_piercer_id,
    p_first_name, p_last_name, p_email, p_phone, p_notes, null
  );
$$;

revoke all on function public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_public_booking(uuid[],timestamptz,uuid,text,text,text,text,text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Range availability: one round trip for a week of openings
-- ---------------------------------------------------------------------------
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
        or slot_start >= now() + make_interval(hours => studio.minimum_lead_hours)
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

-- ---------------------------------------------------------------------------
-- Atomic walk-in / POS sale creation
-- ---------------------------------------------------------------------------
create or replace function public.create_sale(
  p_customer_id uuid,
  p_booking_id uuid,
  p_discount_cents integer,
  p_items jsonb,
  p_payments jsonb,
  p_complete boolean default false
) returns table (id uuid, reference text, total_cents integer, balance_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.sales%rowtype;
  payload jsonb;
  source_id uuid;
  unit_price integer;
  svc public.services%rowtype;
  paid integer;
begin
  if not (select public.is_management()) then
    raise exception using errcode = '42501', message = 'not_authorized';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception using errcode = '22023', message = 'items_required';
  end if;
  if coalesce(p_discount_cents, 0) < 0 then
    raise exception using errcode = '22023', message = 'invalid_discount';
  end if;

  for payload in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(payload ->> 'type', '') = 'service' then
      source_id := nullif(payload ->> 'sourceId', '')::uuid;
      if source_id is null then
        raise exception using errcode = '22023', message = 'service_required';
      end if;
      unit_price := coalesce((payload ->> 'unitPriceCents')::integer, -1);
      select * into svc from public.services s where s.id = source_id and s.is_active;
      if not found then
        raise exception using errcode = 'P0002', message = 'service_unavailable';
      end if;
      if svc.price_cents is not null then
        if unit_price <> svc.price_cents then
          raise exception using errcode = '22023', message = 'invalid_service_price';
        end if;
      elsif svc.min_price_cents is not null and svc.max_price_cents is not null then
        if unit_price < svc.min_price_cents or unit_price > svc.max_price_cents then
          raise exception using errcode = '22023', message = 'invalid_service_price';
        end if;
      else
        raise exception using errcode = '22023', message = 'invalid_service_price';
      end if;
    end if;
  end loop;

  insert into public.sales (customer_id, booking_id, discount_cents, status)
  values (p_customer_id, p_booking_id, coalesce(p_discount_cents, 0), 'draft')
  returning * into created;

  insert into public.sale_items (
    sale_id, item_type, source_id, description, quantity, unit_price_cents, discount_cents
  )
  select
    created.id,
    payload.value ->> 'type',
    nullif(payload.value ->> 'sourceId', '')::uuid,
    payload.value ->> 'description',
    coalesce((payload.value ->> 'quantity')::integer, 1),
    (payload.value ->> 'unitPriceCents')::integer,
    coalesce((payload.value ->> 'discountCents')::integer, 0)
  from jsonb_array_elements(p_items) payload(value);

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' and jsonb_array_length(p_payments) > 0 then
    insert into public.payments (sale_id, method, amount_cents, reference, received_by)
    select
      created.id,
      (pay ->> 'method')::public.payment_method,
      (pay ->> 'amountCents')::integer,
      nullif(pay ->> 'reference', ''),
      (select auth.uid())
    from jsonb_array_elements(p_payments) pay;
  end if;

  select * into created from public.sales s where s.id = created.id;
  select coalesce(sum(p.amount_cents), 0)::integer into paid
    from public.payments p where p.sale_id = created.id;

  if p_complete then
    if paid < created.total_cents then
      raise exception using errcode = '22023', message = 'balance_due';
    end if;
    if exists (select 1 from public.sale_items si where si.sale_id = created.id and si.unit_price_cents is null) then
      raise exception using errcode = '22023', message = 'pricing_required';
    end if;
    update public.sales s
       set status = 'completed',
           completed_at = now(),
           completed_by = (select auth.uid()),
           updated_at = now()
     where s.id = created.id;
    select * into created from public.sales s where s.id = created.id;
  end if;

  return query select created.id, created.reference, created.total_cents, greatest(0, created.total_cents - paid);
end;
$$;

revoke all on function public.create_sale(uuid, uuid, integer, jsonb, jsonb, boolean)
  from public, anon;
grant execute on function public.create_sale(uuid, uuid, integer, jsonb, jsonb, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Report aggregates (INVOKER so RLS still applies)
-- ---------------------------------------------------------------------------
create or replace function public.studio_report()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'revenue_cents', coalesce((
      select sum(
        s.total_cents - coalesce((
          select sum(a.amount_cents) from public.sale_adjustments a where a.sale_id = s.id
        ), 0)
      )
      from public.sales s
      where s.status = 'completed'
    ), 0),
    'completed_sales', coalesce((
      select count(*) from public.sales s where s.status = 'completed'
    ), 0),
    'booking_statuses', coalesce((
      select jsonb_object_agg(status, n)
      from (
        select b.status::text as status, count(*)::bigint as n
        from public.bookings b
        group by b.status
      ) counts
    ), '{}'::jsonb),
    'methods', coalesce((
      select jsonb_object_agg(method, cents)
      from (
        select p.method::text as method, sum(p.amount_cents)::bigint as cents
        from public.payments p
        join public.sales s on s.id = p.sale_id
        where s.status = 'completed'
        group by p.method
      ) methods
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.studio_report() from public, anon;
grant execute on function public.studio_report() to authenticated;

create or replace view public.customer_directory
with (security_invoker = true) as
select
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.created_at,
  count(b.id)::integer as appointment_count,
  max(b.starts_at) as last_appointment_at
from public.customers c
left join public.bookings b on b.customer_id = c.id
group by c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at;

grant select on public.customer_directory to authenticated;
revoke all on public.customer_directory from anon;

create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
