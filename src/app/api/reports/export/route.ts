import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session)
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in is required." } },
      { status: 401 },
    );
  if (!hasRole(session.role, ["owner", "manager"]))
    return Response.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Reports are limited to management.",
        },
      },
      { status: 403 },
    );
  const url = new URL(request.url);
  const from =
    url.searchParams.get("from") ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const to = url.searchParams.get("to") ?? from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return Response.json(
      {
        error: {
          code: "INVALID_DATES",
          message: "Use YYYY-MM-DD report dates.",
        },
      },
      { status: 422 },
    );
  const start = new Date(`${from}T00:00:00+08:00`).toISOString();
  const end = new Date(
    new Date(`${to}T00:00:00+08:00`).getTime() + 86_400_000,
  ).toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!
    .from("sales")
    .select(
      "reference,status,total_cents,created_at,customers(first_name,last_name),bookings(booking_services(position,name)),payments(method,amount_cents),sale_adjustments(kind,amount_cents)",
    )
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at");
  if (error)
    return Response.json(
      { error: { code: "REPORT_FAILED", message: error.message } },
      { status: 400 },
    );
  const rows = [
    "Business date,Sale reference,Customer,Services,Status,Gross PHP,Adjustments PHP,Net PHP,Paid PHP,Payment methods",
    ...(data ?? []).map((sale) => {
      const customer = Array.isArray(sale.customers)
        ? sale.customers[0]
        : sale.customers;
      const payments = sale.payments ?? [];
      const adjustments = sale.sale_adjustments ?? [];
      const booking = Array.isArray(sale.bookings) ? sale.bookings[0] : sale.bookings;
      const services = (booking?.booking_services ?? [])
        .sort((a, b) => a.position - b.position)
        .map((item) => item.name).join(" + ");
      const adjustedCents = adjustments.reduce(
        (sum, item) => sum + item.amount_cents,
        0,
      );
      return [
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
          new Date(sale.created_at),
        ),
        sale.reference,
        customer ? `${customer.first_name} ${customer.last_name}` : "Walk-in",
        services,
        sale.status,
        (sale.total_cents / 100).toFixed(2),
        (adjustedCents / 100).toFixed(2),
        ((sale.total_cents - adjustedCents) / 100).toFixed(2),
        (
          payments.reduce((sum, item) => sum + item.amount_cents, 0) / 100
        ).toFixed(2),
        payments.map((item) => item.method).join("+"),
      ]
        .map(escape)
        .join(",");
    }),
  ];
  return new Response(`\uFEFF${rows.join("\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="piercing-corner-report-${from}-${to}.csv"`,
    },
  });
}
