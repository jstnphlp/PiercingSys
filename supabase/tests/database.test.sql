begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

select has_table('public', 'studio_settings', 'singleton studio settings exists');
select has_table('public', 'staff_profiles', 'staff profiles replace memberships');
select hasnt_table('public', 'shops', 'multi-tenant shops are removed');
select results_eq('select name from public.studio_settings where id = 1', array['Piercing Corner'::text], 'studio is seeded without fictitious details');
select col_is_pk('public', 'studio_settings', 'id', 'studio settings is a singleton primary key');
select has_function('public', 'create_public_booking', array['uuid[]','timestamp with time zone','uuid','text','text','text','text','text'], 'atomic multi-service public booking exists');
select has_function('public', 'create_public_booking_with_result', array['uuid[]','timestamp with time zone','uuid','text','text','text','text','text','text'], 'public booking reports whether an idempotent request created the booking');
select has_function('public', 'create_staff_booking', array['uuid[]','timestamp with time zone','uuid','uuid','uuid','text','text','text','text','text','boolean'], 'atomic staff booking exists');
select has_function('public', 'reschedule_booking', array['uuid','timestamp with time zone','uuid','uuid'], 'schedule-aware rescheduling exists');
select has_function('public', 'complete_booking_and_create_sale', array['uuid'], 'appointment completion creates a sale atomically');
select has_function('public', 'complete_draft_sale', array['uuid'], 'draft completion validation exists');
select has_function('public', 'current_staff_role', array[]::text[], 'role helper exists');
select has_function('public', 'staff_reference_data', array[]::text[], 'staff reference bundle exists');
select ok(
  not has_function_privilege('anon', 'public.staff_reference_data()', 'execute')
    and not has_function_privilege('authenticated', 'public.staff_reference_data()', 'execute')
    and has_function_privilege('service_role', 'public.staff_reference_data()', 'execute'),
  'staff reference bundle is server-only'
);
select policies_are('public', 'sales', array['management_manage_sales'], 'sales are management-only under RLS');
select policies_are('public', 'bookings', array['management_manage_bookings','permitted_booking_read','piercer_update_own_bookings'], 'booking policies cover management and assigned piercers');
select has_table('public', 'booking_services', 'ordered appointment service snapshots exist');
select hasnt_column('public', 'bookings', 'service_id', 'legacy single-service booking column was removed after backfill');
select columns_are('public', 'booking_services', array['id','booking_id','service_id','position','name','duration_minutes','price_cents','min_price_cents','max_price_cents','price_unit','created_at'], 'booking services keep complete ordered snapshots');
select results_eq($$select count(*) from public.services where category in ('Ear Piercings', 'Face & Body Piercings', 'Other Services')$$, array[32::bigint], 'the Piercing Corner service catalog is seeded');
select results_eq($$select count(*) from public.services where price_cents is null and min_price_cents is not null and max_price_cents is not null$$, array[5::bigint], 'range prices are stored as ranges');
select throws_ok($$insert into public.services (name, duration_minutes, price_cents, min_price_cents, max_price_cents) values ('Invalid mixed price', 30, 10000, 10000, 20000)$$, '23514', null, 'a service cannot store a fixed price and a range');
select results_eq($$select price_unit from public.services where name = 'Ultrasonic Jewelry Cleaning'$$, array['per process'::text], 'optional price units are stored');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-owner@example.com', '', now(), now(), now()),
       ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'piercer-one@example.com', '', now(), now(), now()),
       ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'piercer-two@example.com', '', now(), now(), now());
insert into public.staff_profiles (user_id, display_name, role) values
  ('10000000-0000-0000-0000-000000000001', 'Test Staff', case when exists (select 1 from public.staff_profiles where role = 'owner') then 'manager'::public.staff_role else 'owner'::public.staff_role end),
  ('10000000-0000-0000-0000-000000000002', 'Piercer One', 'piercer'),
  ('10000000-0000-0000-0000-000000000003', 'Piercer Two', 'piercer');
insert into public.services (id, name, duration_minutes, price_cents) values
  ('20000000-0000-0000-0000-000000000001', 'Test fixed service', 30, 100000);
insert into public.services (id, name, duration_minutes, price_cents, min_price_cents, max_price_cents) values
  ('20000000-0000-0000-0000-000000000002', 'Test range service', 45, null, 20000, 50000);
insert into public.customers (id, first_name, last_name, email, phone)
values ('30000000-0000-0000-0000-000000000001', 'Test', 'Client', 'client@example.com', '09000000000');
insert into public.sales (id, customer_id, status, subtotal_cents, total_cents, completed_at, completed_by)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'completed', 100000, 100000, now(), '10000000-0000-0000-0000-000000000001');
select throws_ok($$update public.sales set total_cents = 0 where id = '40000000-0000-0000-0000-000000000001'$$, 'Completed sales are immutable; create an adjustment', 'completed sales cannot be edited');

insert into public.bookings (id, customer_id, assigned_piercer_id, starts_at, ends_at)
values ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-09-01 10:00+08', '2026-09-01 11:15+08');
insert into public.booking_services (booking_id, service_id, position, name, duration_minutes, price_cents, min_price_cents, max_price_cents)
values
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'Fixed snapshot',30,100000,null,null),
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',2,'Range snapshot',45,null,20000,50000);
select results_eq($$select name from public.booking_services where booking_id = '50000000-0000-0000-0000-000000000001' order by position$$, array['Fixed snapshot'::text,'Range snapshot'::text], 'appointment service order and names are snapshotted');
select throws_ok($$insert into public.bookings (customer_id, assigned_piercer_id, starts_at, ends_at) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-09-01 10:15+08','2026-09-01 10:45+08')$$, '23P01', null, 'piercer overlaps are rejected');
insert into public.stations (id, name) values ('60000000-0000-0000-0000-000000000001', 'Test station');
insert into public.bookings (customer_id, assigned_piercer_id, station_id, starts_at, ends_at)
values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','2026-09-01 12:00+08','2026-09-01 12:30+08');
select throws_ok($$insert into public.bookings (customer_id, assigned_piercer_id, station_id, starts_at, ends_at) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','2026-09-01 12:15+08','2026-09-01 12:45+08')$$, '23P01', null, 'station overlaps are rejected');
select lives_ok($$insert into public.sale_adjustments (sale_id, kind, amount_cents, reason, actor_id) values ('40000000-0000-0000-0000-000000000001','refund',25000,'Test refund','10000000-0000-0000-0000-000000000001')$$, 'refunds remain append-only adjustments');
select is((select count(*) from public.studio_settings), 1::bigint, 'there is exactly one studio record');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok($$select * from public.complete_booking_and_create_sale('50000000-0000-0000-0000-000000000001')$$, 'appointment completion creates its draft sale');
select is((select count(*) from public.sales where booking_id = '50000000-0000-0000-0000-000000000001'), 1::bigint, 'a booking has only one linked sale');
select is((select count(*) from public.sale_items si join public.sales s on s.id = si.sale_id where s.booking_id = '50000000-0000-0000-0000-000000000001'), 2::bigint, 'each booked service creates one sale item');
select lives_ok($$select * from public.complete_booking_and_create_sale('50000000-0000-0000-0000-000000000001')$$, 'completion can be retried safely');
select is((select count(*) from public.sales where booking_id = '50000000-0000-0000-0000-000000000001'), 1::bigint, 'completion retry does not duplicate the sale');
select is((select count(*) from public.sale_items si join public.sales s on s.id = si.sale_id where s.booking_id = '50000000-0000-0000-0000-000000000001'), 2::bigint, 'completion retry does not duplicate items');
select is((select count(*) from public.sale_items si join public.sales s on s.id = si.sale_id where s.booking_id = '50000000-0000-0000-0000-000000000001' and si.unit_price_cents is null), 1::bigint, 'range-priced service remains unresolved');
select throws_ok($$select public.complete_draft_sale((select id from public.sales where booking_id = '50000000-0000-0000-0000-000000000001'))$$, 'pricing_required', 'a sale with unresolved pricing cannot complete');
update public.sale_items set unit_price_cents = 30000
 where sale_id = (select id from public.sales where booking_id = '50000000-0000-0000-0000-000000000001') and unit_price_cents is null;
insert into public.payments (sale_id, method, amount_cents, received_by)
select id, 'cash', 130000, '10000000-0000-0000-0000-000000000001' from public.sales where booking_id = '50000000-0000-0000-0000-000000000001';
select lives_ok($$select public.complete_draft_sale((select id from public.sales where booking_id = '50000000-0000-0000-0000-000000000001'))$$, 'fully priced and paid sale completes');
select results_eq($$select status::text from public.sales where booking_id = '50000000-0000-0000-0000-000000000001'$$, array['completed'::text], 'linked sale is completed');
select throws_ok($$update public.sale_items set unit_price_cents = 20000 where sale_id = (select id from public.sales where booking_id = '50000000-0000-0000-0000-000000000001') and description = 'Range snapshot'$$, 'Completed sale details are immutable; create an adjustment', 'completed appointment sale items remain immutable');

select has_function('public', 'available_slots', array['uuid[]','date','date','uuid','boolean'], 'range availability lives in postgres');
select has_function('public', 'create_sale', array['uuid','uuid','integer','jsonb','jsonb','boolean'], 'atomic sale creation exists');
select has_function('public', 'studio_report', array[]::text[], 'report aggregates exist');
select has_view('public', 'customer_directory', 'client directory view exists');

insert into public.service_staff (service_id, staff_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')
on conflict do nothing;
insert into public.staff_availability (staff_id, weekday, starts_at, ends_at)
select '10000000-0000-0000-0000-000000000002', weekday, '10:00'::time, '20:00'::time
from generate_series(0, 6) as weekday
on conflict do nothing;

select ok(
  (select count(*) > 0 from public.available_slots(
    array['20000000-0000-0000-0000-000000000001'::uuid],
    '2026-09-01'::date,
    '2026-09-07'::date,
    '10000000-0000-0000-0000-000000000002',
    false
  )),
  'available_slots returns openings for a qualified piercer'
);

select lives_ok(
  $$select * from public.create_sale(
    '30000000-0000-0000-0000-000000000001',
    null,
    0,
    '[{"type":"service","sourceId":"20000000-0000-0000-0000-000000000001","description":"Walk-in lobe","quantity":1,"unitPriceCents":100000,"discountCents":0}]'::jsonb,
    '[{"method":"cash","amountCents":100000}]'::jsonb,
    true
  )$$,
  'create_sale completes a paid walk-in in one transaction'
);
select is(
  (select s.status::text from public.sales s join public.sale_items si on si.sale_id = s.id where si.description = 'Walk-in lobe'),
  'completed',
  'walk-in sale is stored as completed'
);

select results_eq(
  $$select was_created from public.create_public_booking_with_result(
    array['20000000-0000-0000-0000-000000000001'::uuid],
    (select s.starts_at from public.available_slots(
      array['20000000-0000-0000-0000-000000000001'::uuid],
      (now() at time zone 'Asia/Manila')::date + 2,
      (now() at time zone 'Asia/Manila')::date + 5,
      '10000000-0000-0000-0000-000000000002',
      true
    ) s limit 1),
    '10000000-0000-0000-0000-000000000002',
    'Idem', 'Client', 'idempotent@example.com', '09171111111', '',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )$$,
  array[true],
  'the first idempotent public booking reports that it was created'
);
select results_eq(
  $$select was_created from public.create_public_booking_with_result(
    array['20000000-0000-0000-0000-000000000001'::uuid],
    now() + interval '3 days',
    '10000000-0000-0000-0000-000000000002',
    'Idem', 'Client', 'idempotent@example.com', '09171111111', '',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )$$,
  array[false],
  'repeating the same idempotency key reports a replay'
);
select is(
  (select count(*) from public.bookings b join public.customers c on c.id = b.customer_id where c.email = 'idempotent@example.com'),
  1::bigint,
  'idempotent retries share one booking row'
);
select is(
  (select count(*) from public.notification_deliveries d
    join public.bookings b on b.id = d.booking_id
    join public.customers c on c.id = b.customer_id
   where c.email = 'idempotent@example.com' and d.kind = 'confirmation'),
  1::bigint,
  'idempotent retries share one confirmation delivery'
);

select throws_ok(
  $$select public.create_public_booking(
    array['20000000-0000-0000-0000-000000000001'::uuid],
    (select b.starts_at from public.bookings b join public.customers c on c.id = b.customer_id where c.email = 'idempotent@example.com'),
    '10000000-0000-0000-0000-000000000002',
    'Other', 'Client', 'other@example.com', '09172222222', '',
    null
  )$$,
  '23P01',
  'slot_unavailable',
  'a second public booking cannot take an occupied opening'
);

select throws_ok(
  $$select public.create_public_booking(
    array['20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid],
    now() + interval '4 days',
    null, 'A', 'B', 'ab@example.com', '09170000001', '', null
  )$$,
  '22023',
  'invalid_services',
  'duplicate services are rejected'
);

select throws_ok(
  $$select public.create_sale(
    '30000000-0000-0000-0000-000000000001',
    null,
    0,
    '[{"type":"service","sourceId":"20000000-0000-0000-0000-000000000001","description":"Wrong price","quantity":1,"unitPriceCents":1,"discountCents":0}]'::jsonb,
    '[]'::jsonb,
    false
  )$$,
  'invalid_service_price',
  'fixed service prices cannot be overridden at sale time'
);

select throws_ok(
  $$select * from public.available_slots(
    array['20000000-0000-0000-0000-000000000001'::uuid],
    '2026-09-01'::date,
    '2026-09-16'::date,
    null,
    false
  )$$,
  '22023',
  'invalid_date_range',
  'availability refuses ranges longer than 14 days'
);

insert into public.bookings (id, customer_id, assigned_piercer_id, status, starts_at, ends_at)
values (
  '50000000-0000-0000-0000-000000000099',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'cancelled',
  '2026-09-01 10:00+08',
  '2026-09-01 10:45+08'
);
insert into public.booking_services (booking_id, service_id, position, name, duration_minutes, price_cents)
values (
  '50000000-0000-0000-0000-000000000099',
  '20000000-0000-0000-0000-000000000001',
  1,
  'Cancelled hold',
  30,
  100000
);

select ok(
  exists (
    select 1 from public.available_slots(
      array['20000000-0000-0000-0000-000000000001'::uuid],
      '2026-09-01'::date,
      '2026-09-01'::date,
      '10000000-0000-0000-0000-000000000002',
      false
    ) s
    where s.starts_at = timestamptz '2026-09-01 10:00+08'
  ),
  'cancelled bookings do not occupy public openings'
);

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone)
    values ('Dup', 'User', 'Client@example.com', '09000000000')$$,
  '23505',
  null,
  'the same email and phone cannot create a second customer'
);

select * from finish();
rollback;
