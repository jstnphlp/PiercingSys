import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { invalidateStaffReferenceData } from "@/lib/cache-invalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const schema = z.object({
  staffId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6).optional(),
  dateFrom: z.string().regex(datePattern).optional(),
  dateTo: z.string().regex(datePattern).optional(),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
}).superRefine((value, context) => {
  if (value.endsAt <= value.startsAt) context.addIssue({ code: "custom", message: "End time must be after start time.", path: ["endsAt"] });
  if (!value.dateFrom && value.weekday === undefined) context.addIssue({ code: "custom", message: "Choose a date for this schedule block.", path: ["dateFrom"] });
  if (value.dateTo && !value.dateFrom) context.addIssue({ code: "custom", message: "Choose a starting date.", path: ["dateFrom"] });
  if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) context.addIssue({ code: "custom", message: "The ending date must be on or after the starting date.", path: ["dateTo"] });
  if (value.dateFrom && value.dateTo && datesBetween(value.dateFrom, value.dateTo).length > 90) context.addIssue({ code: "custom", message: "A schedule range can cover at most 90 days.", path: ["dateTo"] });
});

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Schedule changes require management access." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const value = parsed.data;
  const supabase = await createSupabaseServerClient();
  if (value.dateFrom) {
    const rows = datesBetween(value.dateFrom, value.dateTo ?? value.dateFrom).map((date) => ({
      staff_id: value.staffId,
      weekday: weekday(date),
      availability_date: date,
      starts_at: value.startsAt,
      ends_at: value.endsAt,
    }));
    const { data, error } = await supabase!.from("staff_availability").insert(rows).select("id");
    if (error) return Response.json({ error: { code: "CREATE_FAILED", message: error.message } }, { status: 400 });
    invalidateStaffReferenceData();
    return Response.json({ data }, { status: 201 });
  }
  const { data, error } = await supabase!.from("staff_availability").insert({ staff_id: value.staffId, weekday: value.weekday, availability_date: null, starts_at: value.startsAt, ends_at: value.endsAt }).select("id").single();
  if (error) return Response.json({ error: { code: "CREATE_FAILED", message: error.message } }, { status: 400 });
  invalidateStaffReferenceData();
  return Response.json({ data }, { status: 201 });
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  const current = new Date(`${from}T12:00:00Z`);
  const last = new Date(`${to}T12:00:00Z`);
  while (current <= last && dates.length <= 90) { dates.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); }
  return dates;
}

function weekday(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
