alter table public.services rename column active to is_active;
alter table public.services alter column price_cents drop not null;
alter table public.services add column min_price_cents integer;
alter table public.services add column max_price_cents integer;
alter table public.services add column price_unit text;
alter table public.services add column category text not null default 'Other Services';

alter table public.services
  drop constraint services_price_cents_check,
  add constraint services_price_cents_check check (price_cents is null or price_cents >= 0),
  add constraint services_min_price_cents_check check (min_price_cents is null or min_price_cents >= 0),
  add constraint services_max_price_cents_check check (max_price_cents is null or max_price_cents >= 0),
  add constraint services_price_definition_check check (
    (price_cents is not null and min_price_cents is null and max_price_cents is null)
    or
    (price_cents is null and min_price_cents is not null and max_price_cents is not null and min_price_cents <= max_price_cents)
  );

create unique index services_name_unique_ci on public.services (lower(name));

update public.services
set name = 'Lobe'
where lower(name) = 'lobe piercing'
  and not exists (select 1 from public.services existing where lower(existing.name) = 'lobe');

insert into public.services (
  name,
  description,
  body_area,
  category,
  duration_minutes,
  price_cents,
  min_price_cents,
  max_price_cents,
  price_unit,
  is_active,
  sort_order
)
values
  ('Lobe', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 50000, null, null, null, true, 100),
  ('Double Lobe', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 95000, null, null, null, true, 101),
  ('Triple Lobe', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 140000, null, null, null, true, 102),
  ('Auricle', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 60000, null, null, null, true, 103),
  ('Helix', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 60000, null, null, null, true, 104),
  ('Hidden Helix', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 105),
  ('Tragus', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 106),
  ('Conch', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 107),
  ('Daith', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 75000, null, null, null, true, 108),
  ('Rook', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 109),
  ('Forward Helix', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 110),
  ('Flat', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 60000, null, null, null, true, 111),
  ('Snug', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 112),
  ('Anti-Tragus', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 113),
  ('Industrial', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 110000, null, null, null, true, 114),
  ('Nostril', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 80000, null, null, null, true, 200),
  ('Septum', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 100000, null, null, null, true, 201),
  ('Eyebrow', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 90000, null, null, null, true, 202),
  ('Navel', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 90000, null, null, null, true, 203),
  ('Bridge', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 95000, null, null, null, true, 204),
  ('Surface', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 280000, null, null, null, true, 205),
  ('Lip Piercing', E'Examples: Labret, Monroe, Medusa, etc.\nBasic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 95000, null, null, null, true, 206),
  ('Oral Piercing', E'Examples: Tongue, Dimple, Smiley, etc.\nBasic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 120000, null, null, null, true, 207),
  ('Nipple', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 100000, null, null, null, true, 208),
  ('Dermal', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 280000, null, null, null, true, 209),
  ('Genital', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 300000, null, null, null, true, 210),
  ('Curation / Earscape', null, null, 'Other Services', 60, null, 10000, 50000, null, true, 300),
  ('Removal / Replacement / Downsize / Cleaning', null, null, 'Other Services', 30, null, 10000, 50000, null, true, 301),
  ('Bump Treatment', null, null, 'Other Services', 30, null, 20000, 50000, null, true, 302),
  ('Authentic No-Pull Disc', null, null, 'Other Services', 15, 25000, null, null, null, true, 303),
  ('Titanium Anodizing', null, null, 'Other Services', 30, null, 20000, 25000, 'per process', true, 304),
  ('Ultrasonic Jewelry Cleaning', E'Supported materials:\nSurgical Steel\nTitanium\nReal Gold (yellow or white)\nDiamonds\n925 Silver', null, 'Other Services', 30, null, 20000, 35000, 'per process', true, 305)
on conflict (lower(name)) do update set
  description = excluded.description,
  body_area = excluded.body_area,
  category = excluded.category,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  min_price_cents = excluded.min_price_cents,
  max_price_cents = excluded.max_price_cents,
  price_unit = excluded.price_unit,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.service_staff (service_id, staff_id)
select services.id, staff_profiles.user_id
from public.services
cross join public.staff_profiles
where services.is_active
  and staff_profiles.active
  and staff_profiles.role = 'piercer'
on conflict do nothing;

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
  select * into selected_service from public.services where services.id = p_service_id and is_active;
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
   where sp.active and sp.role = 'piercer'
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
