-- Include all-status sales and appointment counts so the UI can determine
-- whether a selected period has anything meaningful to export.
create or replace function public.studio_report(p_start timestamptz, p_end timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  range_sales as materialized (
    select s.id, s.status, s.total_cents
    from public.sales s
    where s.created_at >= p_start and s.created_at < p_end
  ),
  completed_sales as materialized (
    select id, total_cents
    from range_sales
    where status = 'completed'
  ),
  adjusted_sales as (
    select
      s.id,
      s.total_cents,
      coalesce(sum(a.amount_cents), 0)::bigint as adjustment_cents
    from completed_sales s
    left join public.sale_adjustments a on a.sale_id = s.id
    group by s.id, s.total_cents
  ),
  sales_totals as (
    select
      coalesce(sum(total_cents - adjustment_cents), 0)::bigint as revenue_cents,
      count(*)::bigint as completed_count
    from adjusted_sales
  ),
  method_counts as (
    select p.method::text as method, sum(p.amount_cents)::bigint as cents
    from completed_sales s
    join public.payments p on p.sale_id = s.id
    group by p.method
  ),
  booking_counts as materialized (
    select b.status::text as status, count(*)::bigint as n
    from public.bookings b
    where b.starts_at >= p_start and b.starts_at < p_end
    group by b.status
  )
  select jsonb_build_object(
    'revenue_cents', totals.revenue_cents,
    'completed_sales', totals.completed_count,
    'sale_count', (select count(*) from range_sales),
    'booking_count', coalesce((select sum(n) from booking_counts), 0),
    'booking_statuses', coalesce(
      (select jsonb_object_agg(status, n) from booking_counts),
      '{}'::jsonb
    ),
    'methods', coalesce(
      (select jsonb_object_agg(method, cents) from method_counts),
      '{}'::jsonb
    )
  )
  from sales_totals totals;
$$;

revoke all on function public.studio_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.studio_report(timestamptz, timestamptz) to authenticated;
