import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { invalidateCatalogAndStaffReferenceData } from "@/lib/cache-invalidation";
import type { StudioSettings } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) })
  .refine((value) => value.close > value.open, { path: ["close"], message: "Closing time must be after opening time." });

async function context(context: { params: Promise<{ weekday: string }> }) {
  const session = await getStaffSession();
  const { weekday: raw } = await context.params;
  const weekday = Number(raw);
  return { allowed: Boolean(session && hasRole(session.role, ["owner", "manager"])), weekday };
}

export async function PATCH(request: Request, routeContext: { params: Promise<{ weekday: string }> }) {
  const auth = await context(routeContext);
  if (!auth.allowed) return Response.json({ error: { code: "FORBIDDEN", message: "Business-hour changes require management access." } }, { status: 403 });
  if (!Number.isInteger(auth.weekday) || auth.weekday < 0 || auth.weekday > 6) return Response.json({ error: { code: "INVALID_WEEKDAY", message: "Weekday must be between 0 and 6." } }, { status: 422 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  return saveHours(auth.weekday, parsed.data);
}

export async function DELETE(_request: Request, routeContext: { params: Promise<{ weekday: string }> }) {
  const auth = await context(routeContext);
  if (!auth.allowed) return Response.json({ error: { code: "FORBIDDEN", message: "Business-hour changes require management access." } }, { status: 403 });
  if (!Number.isInteger(auth.weekday) || auth.weekday < 0 || auth.weekday > 6) return Response.json({ error: { code: "INVALID_WEEKDAY", message: "Weekday must be between 0 and 6." } }, { status: 422 });
  return saveHours(auth.weekday, null);
}

async function saveHours(weekday: number, hours: { open: string; close: string } | null) {
  const supabase = await createSupabaseServerClient();
  const current = await supabase!.from("studio_settings").select("business_hours").eq("id", 1).single();
  if (current.error) return Response.json({ error: { code: "LOOKUP_FAILED", message: current.error.message } }, { status: 400 });
  const businessHours = { ...(current.data.business_hours as StudioSettings["businessHours"]) };
  if (hours) businessHours[String(weekday)] = hours;
  else delete businessHours[String(weekday)];
  const update = await supabase!.from("studio_settings").update({ business_hours: businessHours, updated_at: new Date().toISOString() }).eq("id", 1);
  if (update.error) return Response.json({ error: { code: "UPDATE_FAILED", message: update.error.message } }, { status: 400 });
  invalidateCatalogAndStaffReferenceData();
  return Response.json({ data: { updated: true, recurringWeekday: weekday } });
}
