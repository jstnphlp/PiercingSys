import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { invalidateCatalogAndStaffReferenceData } from "@/lib/cache-invalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const hours = z.record(z.string(), z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), closed: z.boolean().optional() }));
const schema = z.object({ name: z.literal("Piercing Corner").optional(), location: z.string().trim().min(1).max(120).optional(), address: z.string().trim().max(500).nullable().optional(), email: z.string().trim().email().nullable().optional(), phone: z.string().trim().max(30).nullable().optional(), instagramUrl: z.string().url().optional(), businessHours: hours.optional(), bookingIntervalMinutes: z.number().int().min(5).max(240).optional(), minimumLeadHours: z.number().int().min(0).max(8760).optional(), bookingHorizonDays: z.number().int().min(1).max(365).optional(), minimumAge: z.number().int().min(0).max(100).optional(), cancellationPolicy: z.string().trim().max(5000).nullable().optional() });

export async function PATCH(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "You do not have permission to change settings." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const value = parsed.data;
  const update = { ...(value.name !== undefined && { name: value.name }), ...(value.location !== undefined && { location: value.location }), ...(value.address !== undefined && { address: value.address || null }), ...(value.email !== undefined && { email: value.email || null }), ...(value.phone !== undefined && { phone: value.phone || null }), ...(value.instagramUrl !== undefined && { instagram_url: value.instagramUrl }), ...(value.businessHours !== undefined && { business_hours: value.businessHours }), ...(value.bookingIntervalMinutes !== undefined && { booking_interval_minutes: value.bookingIntervalMinutes }), ...(value.minimumLeadHours !== undefined && { minimum_lead_hours: value.minimumLeadHours }), ...(value.bookingHorizonDays !== undefined && { booking_horizon_days: value.bookingHorizonDays }), ...(value.minimumAge !== undefined && { minimum_age: value.minimumAge }), ...(value.cancellationPolicy !== undefined && { cancellation_policy: value.cancellationPolicy || null }), updated_at: new Date().toISOString() };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("studio_settings").update(update).eq("id", 1);
  if (error) return Response.json({ error: { code: "UPDATE_FAILED", message: error.message } }, { status: 400 });
  invalidateCatalogAndStaffReferenceData();
  return Response.json({ data: { saved: true } });
}
