-- Reinstall the function with conflict handling that cannot collide with its
-- table-shaped output parameter names.
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
