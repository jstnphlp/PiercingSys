-- Range-aware overload. The existing studio_report() remains available.
create or replace function public.studio_report(p_start timestamptz, p_end timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'revenue_cents', coalesce((
      select sum(s.total_cents - coalesce((
        select sum(a.amount_cents) from public.sale_adjustments a where a.sale_id = s.id
      ), 0))
      from public.sales s
      where s.status = 'completed'
        and s.created_at >= p_start
        and s.created_at < p_end
    ), 0),
    'completed_sales', coalesce((
      select count(*) from public.sales s
      where s.status = 'completed'
        and s.created_at >= p_start
        and s.created_at < p_end
    ), 0),
    'booking_statuses', coalesce((
      select jsonb_object_agg(status, n)
      from (
        select b.status::text as status, count(*)::bigint as n
        from public.bookings b
        where b.starts_at >= p_start and b.starts_at < p_end
        group by b.status
      ) counts
    ), '{}'::jsonb),
    'methods', coalesce((
      select jsonb_object_agg(method, cents)
      from (
        select p.method::text as method, sum(p.amount_cents)::bigint as cents
        from public.payments p
        join public.sales s on s.id = p.sale_id
        where s.status = 'completed'
          and s.created_at >= p_start
          and s.created_at < p_end
        group by p.method
      ) methods
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.studio_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.studio_report(timestamptz, timestamptz) to authenticated;
