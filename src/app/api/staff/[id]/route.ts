import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { invalidateCatalogAndStaffReferenceData } from "@/lib/cache-invalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ role: z.enum(["owner", "manager", "piercer"]).optional(), active: z.boolean().optional(), displayName: z.string().trim().min(1).max(100).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (session.role !== "owner") return Response.json({ error: { code: "FORBIDDEN", message: "Only the owner can manage staff roles." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const { id } = await context.params; const supabase = await createSupabaseServerClient();
  if (parsed.data.role === "owner") {
    const transfer = await supabase!.rpc("transfer_ownership", { new_owner_id: id });
    if (transfer.error) return Response.json({ error: { code: "TRANSFER_FAILED", message: transfer.error.message } }, { status: 400 });
    invalidateCatalogAndStaffReferenceData();
    return Response.json({ data: { updated: true } });
  }
  const update = { ...(parsed.data.role && { role: parsed.data.role }), ...(parsed.data.active !== undefined && { active: parsed.data.active }), ...(parsed.data.displayName && { display_name: parsed.data.displayName }), updated_at: new Date().toISOString() };
  const result = await supabase!.from("staff_profiles").update(update).eq("user_id", id);
  if (result.error) return Response.json({ error: { code: "UPDATE_FAILED", message: result.error.message } }, { status: 400 });
  invalidateCatalogAndStaffReferenceData();
  return Response.json({ data: { updated: true } });
}
