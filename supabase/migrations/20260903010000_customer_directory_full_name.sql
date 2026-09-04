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
  max(b.starts_at) as last_appointment_at,
  concat_ws(' ', c.first_name, c.last_name) as full_name
from public.customers c
left join public.bookings b on b.customer_id = c.id
group by c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at;

grant select on public.customer_directory to authenticated;
revoke all on public.customer_directory from anon;
