begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'studio_settings', 'singleton studio settings exists');
select has_table('public', 'staff_profiles', 'staff profiles replace memberships');
select hasnt_table('public', 'shops', 'multi-tenant shops are removed');
select results_eq('select name from public.studio_settings where id = 1', array['Piercing Corner'::text], 'studio is seeded without fictitious details');
select col_is_pk('public', 'studio_settings', 'id', 'studio settings is a singleton primary key');
select has_function('public', 'create_public_booking', array['uuid','timestamp with time zone','uuid','text','text','text','text','text'], 'atomic booking function exists');
select has_function('public', 'current_staff_role', array[]::text[], 'role helper exists');
select policies_are('public', 'sales', array['management_manage_sales'], 'sales are management-only under RLS');
select policies_are('public', 'bookings', array['management_manage_bookings','permitted_booking_read','piercer_update_own_bookings'], 'booking policies cover management and assigned piercers');
select results_eq($$select count(*) from public.services where category in ('Ear Piercings', 'Face & Body Piercings', 'Other Services')$$, array[32::bigint], 'the Piercing Corner service catalog is seeded');
select results_eq($$select count(*) from public.services where price_cents is null and min_price_cents is not null and max_price_cents is not null$$, array[5::bigint], 'range prices are stored as ranges');
select throws_ok($$insert into public.services (name, duration_minutes, price_cents, min_price_cents, max_price_cents) values ('Invalid mixed price', 30, 10000, 10000, 20000)$$, '23514', null, 'a service cannot store a fixed price and a range');
select results_eq($$select price_unit from public.services where name = 'Ultrasonic Jewelry Cleaning'$$, array['per process'::text], 'optional price units are stored');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-owner@example.com', '', now(), now(), now()),
       ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'piercer-one@example.com', '', now(), now(), now()),
       ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'piercer-two@example.com', '', now(), now(), now());
insert into public.staff_profiles (user_id, display_name, role) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Test Staff',
    case
      when exists (select 1 from public.staff_profiles where role = 'owner') then 'manager'::public.staff_role
      else 'owner'::public.staff_role
    end
  ),
  ('10000000-0000-0000-0000-000000000002', 'Piercer One', 'piercer'),
  ('10000000-0000-0000-0000-000000000003', 'Piercer Two', 'piercer');
insert into public.services (id, name, duration_minutes, price_cents) values ('20000000-0000-0000-0000-000000000001', 'Test service', 30, 100000);
insert into public.customers (id, first_name, last_name, email, phone) values ('30000000-0000-0000-0000-000000000001', 'Test', 'Client', 'client@example.com', '09000000000');
insert into public.sales (id, customer_id, status, subtotal_cents, total_cents, completed_at, completed_by)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'completed', 100000, 100000, now(), '10000000-0000-0000-0000-000000000001');
select throws_ok($$update public.sales set total_cents = 0 where id = '40000000-0000-0000-0000-000000000001'$$, 'Completed sales are immutable; create an adjustment', 'completed sales cannot be edited');

insert into public.bookings (id, customer_id, service_id, assigned_piercer_id, starts_at, ends_at)
values ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-09-01 10:00+08', '2026-09-01 10:30+08');
select throws_ok($$insert into public.bookings (customer_id, service_id, assigned_piercer_id, starts_at, ends_at) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-09-01 10:15+08','2026-09-01 10:45+08')$$, '23P01', null, 'piercer overlaps are rejected');
insert into public.stations (id, name) values ('60000000-0000-0000-0000-000000000001', 'Test station');
insert into public.bookings (customer_id, service_id, assigned_piercer_id, station_id, starts_at, ends_at)
values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001','2026-09-01 11:00+08','2026-09-01 11:30+08');
select throws_ok($$insert into public.bookings (customer_id, service_id, assigned_piercer_id, station_id, starts_at, ends_at) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000001','2026-09-01 11:15+08','2026-09-01 11:45+08')$$, '23P01', null, 'station overlaps are rejected');
select lives_ok($$insert into public.sale_adjustments (sale_id, kind, amount_cents, reason, actor_id) values ('40000000-0000-0000-0000-000000000001','refund',25000,'Test refund','10000000-0000-0000-0000-000000000001')$$, 'refunds remain append-only adjustments');
select is((select count(*) from public.studio_settings), 1::bigint, 'there is exactly one studio record');

select * from finish();
rollback;
