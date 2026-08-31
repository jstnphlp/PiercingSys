import ExcelJS from "exceljs";
import { getStaffSession, hasRole } from "@/lib/auth";
import { REPORT_TIME_ZONE, validateReportRange } from "@/lib/report-period";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const PAGE_SIZE = 1000;
const PHP_FORMAT = '₱#,##0.00;[Red]-₱#,##0.00';

type ExportSale = {
  reference: string; status: string; total_cents: number; created_at: string;
  customers: { first_name: string; last_name: string } | Array<{ first_name: string; last_name: string }> | null;
  bookings: { booking_services: Array<{ position: number; name: string }> } | Array<{ booking_services: Array<{ position: number; name: string }> }> | null;
  payments: Array<{ method: string; amount_cents: number }>;
  sale_adjustments: Array<{ kind: string; amount_cents: number }>;
};
type BookingOutcome = { status: string };

function first<T>(relation: T | T[] | null) { return Array.isArray(relation) ? relation[0] ?? null : relation; }

function manilaExcelDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")));
}

async function readAllPages<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Reports are limited to management." } }, { status: 403 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const validated = validateReportRange(from, to);
  if (!validated.ok) return Response.json({ error: { code: "INVALID_DATES", message: validated.message } }, { status: 422 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: { code: "REPORT_FAILED", message: "Supabase is not configured." } }, { status: 400 });

  let sales: ExportSale[];
  let bookings: BookingOutcome[];
  try {
    [sales, bookings] = await Promise.all([
      readAllPages<ExportSale>((pageFrom, pageTo) => supabase.from("sales")
        .select("reference,status,total_cents,created_at,customers(first_name,last_name),bookings(booking_services(position,name)),payments(method,amount_cents),sale_adjustments(kind,amount_cents)")
        .gte("created_at", validated.period.startUtc).lt("created_at", validated.period.endUtc).order("created_at").range(pageFrom, pageTo)),
      readAllPages<BookingOutcome>((pageFrom, pageTo) => supabase.from("bookings").select("status")
        .gte("starts_at", validated.period.startUtc).lt("starts_at", validated.period.endUtc).order("starts_at").range(pageFrom, pageTo)),
    ]);
  } catch (error) {
    return Response.json({ error: { code: "REPORT_FAILED", message: error instanceof Error ? error.message : "Report data could not be loaded." } }, { status: 400 });
  }

  if (sales.length === 0) {
    return Response.json(
      { error: { code: "NO_REPORT_DATA", message: "There are no sales to export for this period." } },
      { status: 422 },
    );
  }

  const adjustedCents = (sale: ExportSale) => (sale.sale_adjustments ?? []).reduce((sum, item) => sum + item.amount_cents, 0);
  const paidCents = (sale: ExportSale) => (sale.payments ?? []).reduce((sum, item) => sum + item.amount_cents, 0);
  const completed = sales.filter((sale) => sale.status === "completed");
  const revenueCents = completed.reduce((sum, sale) => sum + sale.total_cents - adjustedCents(sale), 0);
  const methodTotals = new Map<string, number>();
  for (const sale of completed) for (const payment of sale.payments ?? []) methodTotals.set(payment.method, (methodTotals.get(payment.method) ?? 0) + payment.amount_cents);
  const outcomes = new Map<string, number>();
  for (const booking of bookings) outcomes.set(booking.status, (outcomes.get(booking.status) ?? 0) + 1);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Piercing Corner";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.columns = [{ width: 30 }, { width: 24 }];
  summary.addRows([
    ["Piercing Corner Report", null],
    ["Selected period", `${from} to ${to} (inclusive)`],
    ["Generated", new Intl.DateTimeFormat("en-PH", { timeZone: REPORT_TIME_ZONE, dateStyle: "medium", timeStyle: "medium" }).format(new Date())],
    ["Recognized revenue", revenueCents / 100],
    ["Completed transactions", completed.length],
    [], ["Appointment outcomes", "Count"],
    ...["requested", "confirmed", "completed", "cancelled", "no_show", "rejected"].map((status) => [status.replaceAll("_", " "), outcomes.get(status) ?? 0]),
    [], ["Payment methods", "Amount (PHP)"],
    ...[...methodTotals].sort(([a], [b]) => a.localeCompare(b)).map(([method, cents]) => [method.replaceAll("_", " "), cents / 100]),
  ]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E2923" } };
  summary.getCell("B4").numFmt = PHP_FORMAT;
  summary.eachRow((row) => { row.alignment = { vertical: "middle" }; });
  for (let row = 15; row <= summary.rowCount; row += 1) summary.getCell(row, 2).numFmt = PHP_FORMAT;

  const salesSheet = workbook.addWorksheet("Sales", { views: [{ state: "frozen", ySplit: 1 }] });
  const salesRows = sales.map((sale) => {
    const customer = first(sale.customers);
    const booking = first(sale.bookings);
    const adjustments = adjustedCents(sale);
    const paid = paidCents(sale);
    const net = sale.total_cents - adjustments;
    return [manilaExcelDate(sale.created_at), sale.reference,
      customer ? `${customer.first_name} ${customer.last_name}` : "Walk-in",
      [...(booking?.booking_services ?? [])].sort((a, b) => a.position - b.position).map((item) => item.name).join(" + "),
      sale.status, sale.total_cents / 100, adjustments / 100, net / 100, paid / 100,
      Math.max(0, net - paid) / 100, (sale.payments ?? []).map((payment) => payment.method).join(" + ")];
  });
  salesSheet.addTable({
    name: "SalesReport", ref: "A1", headerRow: true, totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: ["Business date/time", "Reference", "Customer", "Services", "Status", "Gross PHP", "Adjustments PHP", "Net PHP", "Paid PHP", "Balance PHP", "Payment methods"].map((name) => ({ name, filterButton: true })),
    // Excel requires a table to cover at least one data row. Keep a blank row
    // for empty reports so the headers and their filters remain valid.
    rows: salesRows.length ? salesRows : [Array.from({ length: 11 }, () => null)],
  });
  [20, 17, 24, 34, 14, 15, 17, 15, 15, 15, 24].forEach((width, index) => { salesSheet.getColumn(index + 1).width = width; });
  salesSheet.getColumn(1).numFmt = "yyyy-mm-dd hh:mm";
  for (let column = 6; column <= 10; column += 1) salesSheet.getColumn(column).numFmt = PHP_FORMAT;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), { headers: {
    "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition": `attachment; filename="piercing-corner-report-${from}-${to}.xlsx"`,
    "cache-control": "private, no-store",
  } });
}
