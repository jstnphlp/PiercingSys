-- Stable, bounded staff list ordering. Existing single-column indexes continue
-- to support the range and status predicates used elsewhere.
create index if not exists customers_created_at_id_idx
  on public.customers (created_at desc, id desc);

create index if not exists sales_created_at_id_idx
  on public.sales (created_at desc, id desc);
