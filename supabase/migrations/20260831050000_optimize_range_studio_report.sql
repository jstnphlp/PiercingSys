-- Reuse the filtered sales set instead of scanning the same date range for
-- revenue, transaction counts, and payment methods independently.
create or replace function public.studio_report(p_start timestamptz, p_end timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  completed_sales as materialized (
    select s.id, s.total_cents
    from public.sales s
    where s.status = 'completed'
      and s.created_at >= p_start
      and s.created_at < p_end
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
  booking_counts as (
    select b.status::text as status, count(*)::bigint as n
    from public.bookings b
    where b.starts_at >= p_start and b.starts_at < p_end
    group by b.status
  )
  select jsonb_build_object(
    'revenue_cents', totals.revenue_cents,
    'completed_sales', totals.completed_count,
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
