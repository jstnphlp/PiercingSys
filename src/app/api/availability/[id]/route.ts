import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({
  staffId: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  availabilityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

async function authorize() {
  const session = await getStaffSession();
  return session && hasRole(session.role, ["owner", "manager"]);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return Response.json({ error: { code: "FORBIDDEN", message: "Schedule changes require management access." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const value = parsed.data;
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) return Response.json({ error: { code: "INVALID_TIME", message: "End time must be after start time." } }, { status: 422 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("staff_availability").update({
    ...(value.staffId && { staff_id: value.staffId }), ...(value.availabilityDate ? { availability_date: value.availabilityDate, weekday: new Date(`${value.availabilityDate}T12:00:00Z`).getUTCDay() } : value.weekday !== undefined ? { weekday: value.weekday } : {}),
    ...(value.startsAt && { starts_at: value.startsAt }), ...(value.endsAt && { ends_at: value.endsAt }),
  }).eq("id", id);
  if (error) return Response.json({ error: { code: "UPDATE_FAILED", message: error.message } }, { status: 400 });
  return Response.json({ data: { updated: true } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return Response.json({ error: { code: "FORBIDDEN", message: "Schedule changes require management access." } }, { status: 403 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("staff_availability").delete().eq("id", id);
  if (error) return Response.json({ error: { code: "DELETE_FAILED", message: error.message } }, { status: 400 });
  return Response.json({ data: { deleted: true } });
}
