import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { invalidateStaffReferenceData } from "@/lib/cache-invalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().max(300).nullable().optional(),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { path: ["endsAt"], message: "Closure end must be after its start." });

async function authorize() {
  const session = await getStaffSession();
  return session && hasRole(session.role, ["owner", "manager"]);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return Response.json({ error: { code: "FORBIDDEN", message: "Closure changes require management access." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("closures").update({ starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt, reason: parsed.data.reason ?? null }).eq("id", id);
  if (error) return Response.json({ error: { code: "UPDATE_FAILED", message: error.message } }, { status: 400 });
  invalidateStaffReferenceData();
  return Response.json({ data: { updated: true } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorize()) return Response.json({ error: { code: "FORBIDDEN", message: "Closure changes require management access." } }, { status: 403 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.from("closures").delete().eq("id", id);
  if (error) return Response.json({ error: { code: "DELETE_FAILED", message: error.message } }, { status: 400 });
  invalidateStaffReferenceData();
  return Response.json({ data: { deleted: true } });
}
