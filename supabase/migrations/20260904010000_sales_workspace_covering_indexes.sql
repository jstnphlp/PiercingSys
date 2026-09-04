-- Keep the management sales workspace's ordered page and embedded relation
-- reads on indexes that contain every projected scalar value. RLS remains the
-- authorization boundary; these indexes only reduce heap reads.
create index if not exists sales_workspace_page_cover_idx
  on public.sales (created_at desc, id desc)
  include (reference, status, total_cents, booking_id, customer_id);

create index if not exists payments_sale_workspace_cover_idx
  on public.payments (sale_id)
  include (method, amount_cents);

create index if not exists sale_adjustments_sale_workspace_cover_idx
  on public.sale_adjustments (sale_id)
  include (amount_cents);

create index if not exists sale_items_sale_workspace_cover_idx
  on public.sale_items (sale_id)
  include (id, description, unit_price_cents, min_price_cents, max_price_cents);
