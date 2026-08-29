create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.staff_role as enum ('owner', 'manager', 'piercer');
create type public.booking_status as enum ('requested', 'confirmed', 'completed', 'rejected', 'cancelled', 'no_show');
create type public.payment_method as enum ('cash', 'gcash', 'maya', 'bank_transfer', 'card', 'other');
create type public.sale_status as enum ('draft', 'completed', 'voided');

create table public.studio_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Piercing Corner',
  location text not null default 'Parañaque',
  address text,
  email text,
  phone text,
  instagram_url text not null default 'https://www.instagram.com/piercing.corner/',
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  currency text not null default 'PHP' check (currency = 'PHP'),
  business_hours jsonb not null default '{}',
  booking_interval_minutes integer not null default 30 check (booking_interval_minutes between 5 and 240),
  minimum_lead_hours integer not null default 24 check (minimum_lead_hours between 0 and 8760),
  booking_horizon_days integer not null default 60 check (booking_horizon_days between 1 and 365),
  minimum_age integer not null default 18 check (minimum_age between 0 and 100),
  cancellation_policy text,
  updated_at timestamptz not null default now()
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role public.staff_role not null,
  active boolean not null default true,
  color text not null default '#78b8aa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_active_owner on public.staff_profiles ((role)) where role = 'owner' and active;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  body_area text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_staff (
  service_id uuid not null references public.services on delete cascade,
  staff_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  primary key (service_id, staff_id)
);

create table public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),
  unique (staff_id, weekday, starts_at, ends_at)
);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text,
  created_at timestamptz not null default now()
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_email_index on public.customers (lower(email));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('PC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_id uuid not null references public.customers,
  service_id uuid not null references public.services,
  assigned_piercer_id uuid references public.staff_profiles(user_id),
  station_id uuid references public.stations,
  status public.booking_status not null default 'confirmed',
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('confirmed', 'completed', 'no_show') or assigned_piercer_id is not null)
);

alter table public.bookings add constraint no_piercer_overlap exclude using gist (
  assigned_piercer_id with =, tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('confirmed', 'completed', 'no_show'));
alter table public.bookings add constraint no_station_overlap exclude using gist (
  station_id with =, tstzrange(starts_at, ends_at, '[)') with &&
) where (station_id is not null and status in ('confirmed', 'completed', 'no_show'));

create table public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings on delete cascade,
  version integer not null default 1,
  answers jsonb not null default '{}',
  typed_acknowledgement text not null,
  guardian jsonb,
  accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SALE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  booking_id uuid references public.bookings,
  customer_id uuid references public.customers,
  status public.sale_status not null default 'draft',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  completed_at timestamptz,
  completed_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null))
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales on delete cascade,
  item_type text not null check (item_type in ('service', 'jewelry', 'other')),
  source_id uuid,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales,
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  reference text,
  received_at timestamptz not null default now(),
  received_by uuid not null references auth.users
);

create table public.sale_adjustments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales,
  kind text not null check (kind in ('void', 'refund')),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (length(trim(reason)) > 0),
  actor_id uuid not null references auth.users,
  created_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings on delete set null,
  kind text not null check (kind in ('confirmation', 'reschedule', 'cancellation')),
  recipient text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_id text,
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.studio_settings (id) values (1);

create or replace function public.current_staff_role()
returns public.staff_role language sql stable security definer set search_path = '' as $$
  select role from public.staff_profiles where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.is_management()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_staff_role() in ('owner', 'manager'), false);
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_staff_role() = 'owner', false);
$$;

create or replace function public.can_access_booking(target_piercer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_management() or (auth.uid() = target_piercer and public.current_staff_role() = 'piercer');
$$;

create or replace function public.ensure_active_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.staff_profiles) and not exists (select 1 from public.staff_profiles where role = 'owner' and active) then
    raise exception 'An active owner is required';
  end if;
  return null;
end;
$$;
create constraint trigger require_active_owner after insert or update or delete on public.staff_profiles
deferrable initially deferred for each row execute function public.ensure_active_owner();

create or replace function public.transfer_ownership(new_owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'Only the owner can transfer ownership'; end if;
  if not exists (select 1 from public.staff_profiles where user_id = new_owner_id and active) then raise exception 'The new owner must be active staff'; end if;
  update public.staff_profiles set role = 'manager', updated_at = now() where user_id = auth.uid();
  update public.staff_profiles set role = 'owner', updated_at = now() where user_id = new_owner_id;
  insert into public.audit_events (actor_id, event_type, entity_type, entity_id) values (auth.uid(), 'ownership.transferred', 'staff_profile', new_owner_id);
end;
$$;
revoke all on function public.transfer_ownership(uuid) from public, anon;
grant execute on function public.transfer_ownership(uuid) to authenticated;

create or replace function public.protect_completed_sale()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'completed' then raise exception 'Completed sales are immutable; create an adjustment'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger completed_sales_immutable before update or delete on public.sales for each row execute function public.protect_completed_sale();

create or replace function public.protect_completed_sale_children()
returns trigger language plpgsql set search_path = '' as $$
declare target_sale uuid;
begin
  if tg_op = 'DELETE' then target_sale := old.sale_id; else target_sale := new.sale_id; end if;
  if exists (select 1 from public.sales where id = target_sale and status = 'completed') then
    raise exception 'Completed sale details are immutable; create an adjustment';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger completed_sale_items_immutable before insert or update or delete on public.sale_items for each row execute function public.protect_completed_sale_children();
create trigger completed_sale_payments_immutable before insert or update or delete on public.payments for each row execute function public.protect_completed_sale_children();

create or replace function public.create_public_booking(
  p_service_id uuid, p_starts_at timestamptz, p_preferred_piercer_id uuid,
  p_first_name text, p_last_name text, p_email text, p_phone text, p_notes text
) returns table (id uuid, reference text, status public.booking_status, starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  studio public.studio_settings%rowtype;
  selected_service public.services%rowtype;
  selected_piercer uuid;
  calculated_end timestamptz;
  local_start timestamp;
  local_date date;
  local_time time;
  local_weekday integer;
  hours jsonb;
  customer uuid;
  created_booking public.bookings%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_starts_at::text));
  select * into studio from public.studio_settings where studio_settings.id = 1;
  select * into selected_service from public.services where services.id = p_service_id and active;
  if not found then raise exception using errcode = 'P0002', message = 'service_unavailable'; end if;
  if studio.business_hours = '{}'::jsonb then raise exception using errcode = 'P0001', message = 'booking_not_configured'; end if;
  if p_starts_at < now() + make_interval(hours => studio.minimum_lead_hours)
     or p_starts_at > now() + make_interval(days => studio.booking_horizon_days) then
    raise exception using errcode = '22007', message = 'slot_outside_booking_window';
  end if;
  calculated_end := p_starts_at + make_interval(mins => selected_service.duration_minutes);
  local_start := p_starts_at at time zone 'Asia/Manila';
  local_date := local_start::date;
  local_time := local_start::time;
  local_weekday := extract(dow from local_date);
  hours := studio.business_hours -> local_weekday::text;
  if hours is null or coalesce((hours ->> 'closed')::boolean, false)
     or local_time < (hours ->> 'open')::time
     or (calculated_end at time zone 'Asia/Manila')::time > (hours ->> 'close')::time then
    raise exception using errcode = '22007', message = 'outside_business_hours';
  end if;
  if exists (select 1 from public.closures where p_starts_at < closures.ends_at and calculated_end > closures.starts_at)
     or exists (select 1 from public.bookings where bookings.starts_at = p_starts_at and bookings.status in ('confirmed', 'completed', 'no_show')) then
    raise exception using errcode = '23P01', message = 'slot_unavailable';
  end if;
  select sp.user_id into selected_piercer
    from public.staff_profiles sp
    join public.service_staff ss on ss.staff_id = sp.user_id and ss.service_id = p_service_id
    join public.staff_availability sa on sa.staff_id = sp.user_id and sa.weekday = local_weekday
   where sp.active and sp.role in ('owner', 'manager', 'piercer')
     and (p_preferred_piercer_id is null or sp.user_id = p_preferred_piercer_id)
     and local_time >= sa.starts_at and (calculated_end at time zone 'Asia/Manila')::time <= sa.ends_at
     and not exists (
       select 1 from public.bookings b where b.assigned_piercer_id = sp.user_id
       and b.status in ('confirmed', 'completed', 'no_show')
       and p_starts_at < b.ends_at and calculated_end > b.starts_at
     )
   order by sp.created_at limit 1;
  if selected_piercer is null then raise exception using errcode = '23P01', message = 'slot_unavailable'; end if;
  select customers.id into customer from public.customers
   where lower(customers.email) = lower(trim(p_email)) and customers.phone = trim(p_phone) order by created_at limit 1;
  if customer is null then
    insert into public.customers (first_name, last_name, email, phone)
    values (trim(p_first_name), trim(p_last_name), lower(trim(p_email)), trim(p_phone)) returning customers.id into customer;
  else
    update public.customers set first_name = trim(p_first_name), last_name = trim(p_last_name), updated_at = now() where customers.id = customer;
  end if;
  insert into public.bookings (customer_id, service_id, assigned_piercer_id, status, starts_at, ends_at, notes)
  values (customer, p_service_id, selected_piercer, 'confirmed', p_starts_at, calculated_end, nullif(trim(p_notes), ''))
  returning * into created_booking;
  insert into public.notification_deliveries (booking_id, kind, recipient, idempotency_key)
  values (created_booking.id, 'confirmation', lower(trim(p_email)), created_booking.id::text || ':confirmation');
  return query select created_booking.id, created_booking.reference, created_booking.status, created_booking.starts_at, created_booking.ends_at;
end;
$$;

revoke all on function public.create_public_booking(uuid,timestamptz,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_public_booking(uuid,timestamptz,uuid,text,text,text,text,text) to service_role;

create or replace function public.bootstrap_first_owner(owner_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if exists (select 1 from public.staff_profiles) then raise exception 'Staff bootstrap is already complete'; end if;
  select id into owner_id from auth.users where lower(email) = lower(trim(owner_email));
  if owner_id is null then raise exception 'Invite this email in Supabase Auth before bootstrapping'; end if;
  insert into public.staff_profiles (user_id, display_name, role)
  values (owner_id, 'Studio owner', 'owner');
  return owner_id;
end;
$$;
revoke all on function public.bootstrap_first_owner(text) from public, anon, authenticated;

do $$ declare table_name text; begin
  foreach table_name in array array[
    'studio_settings','staff_profiles','services','service_staff','staff_availability','closures','stations','customers',
    'bookings','booking_photos','consent_forms','sales','sale_items','payments','sale_adjustments','notification_deliveries','audit_events'
  ] loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

create policy staff_read_settings on public.studio_settings for select to authenticated using (public.current_staff_role() is not null);
create policy management_update_settings on public.studio_settings for update to authenticated using (public.is_management()) with check (public.is_management());
create policy staff_read_profiles on public.staff_profiles for select to authenticated using (public.current_staff_role() is not null);
create policy owner_manage_profiles on public.staff_profiles for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy staff_read_services on public.services for select to authenticated using (public.current_staff_role() is not null);
create policy management_manage_services on public.services for all to authenticated using (public.is_management()) with check (public.is_management());
create policy staff_read_service_assignments on public.service_staff for select to authenticated using (public.current_staff_role() is not null);
create policy management_manage_service_assignments on public.service_staff for all to authenticated using (public.is_management()) with check (public.is_management());
create policy staff_read_availability on public.staff_availability for select to authenticated using (public.current_staff_role() is not null);
create policy management_manage_availability on public.staff_availability for all to authenticated using (public.is_management()) with check (public.is_management());
create policy staff_read_closures on public.closures for select to authenticated using (public.current_staff_role() is not null);
create policy management_manage_closures on public.closures for all to authenticated using (public.is_management()) with check (public.is_management());
create policy staff_read_stations on public.stations for select to authenticated using (public.current_staff_role() is not null);
create policy management_manage_stations on public.stations for all to authenticated using (public.is_management()) with check (public.is_management());
create policy permitted_customer_read on public.customers for select to authenticated using (
  public.is_management() or exists (select 1 from public.bookings b where b.customer_id = customers.id and b.assigned_piercer_id = auth.uid())
);
create policy management_manage_customers on public.customers for all to authenticated using (public.is_management()) with check (public.is_management());
create policy permitted_booking_read on public.bookings for select to authenticated using (public.can_access_booking(assigned_piercer_id));
create policy management_manage_bookings on public.bookings for all to authenticated using (public.is_management()) with check (public.is_management());
create policy piercer_update_own_bookings on public.bookings for update to authenticated using (assigned_piercer_id = auth.uid() and public.current_staff_role() = 'piercer') with check (assigned_piercer_id = auth.uid());
create policy permitted_photo_read on public.booking_photos for select to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id and public.can_access_booking(b.assigned_piercer_id))
);
create policy permitted_consent_read on public.consent_forms for select to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id and public.can_access_booking(b.assigned_piercer_id))
);
create policy management_manage_consent on public.consent_forms for all to authenticated using (public.is_management()) with check (public.is_management());
create policy management_manage_sales on public.sales for all to authenticated using (public.is_management()) with check (public.is_management());
create policy management_manage_sale_items on public.sale_items for all to authenticated using (public.is_management()) with check (public.is_management());
create policy management_manage_payments on public.payments for all to authenticated using (public.is_management()) with check (public.is_management());
create policy management_manage_adjustments on public.sale_adjustments for all to authenticated using (public.is_management()) with check (public.is_management());
create policy management_read_notifications on public.notification_deliveries for select to authenticated using (public.is_management());
create policy management_read_audit on public.audit_events for select to authenticated using (public.is_management());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-photos', 'booking-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png'];

create policy staff_read_booking_photos on storage.objects for select to authenticated using (
  bucket_id = 'booking-photos' and exists (
    select 1 from public.booking_photos bp join public.bookings b on b.id = bp.booking_id
    where bp.storage_path = name and public.can_access_booking(b.assigned_piercer_id)
  )
);
