import { z } from "zod";
import { revalidateTag } from "next/cache";
import { getStaffSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ email: z.string().trim().email(), displayName: z.string().trim().min(1).max(100), role: z.enum(["manager", "piercer"]) });
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (session.role !== "owner") return Response.json({ error: { code: "FORBIDDEN", message: "Only the owner can invite or manage staff." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: { code: "NOT_CONFIGURED", message: "Server credentials are missing." } }, { status: 503 });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email);
  if (error || !data.user) return Response.json({ error: { code: "INVITE_FAILED", message: error?.message ?? "Invitation failed." } }, { status: 400 });
  const profile = await admin.from("staff_profiles").upsert({ user_id: data.user.id, display_name: parsed.data.displayName, role: parsed.data.role, active: true });
  if (profile.error) return Response.json({ error: { code: "PROFILE_FAILED", message: profile.error.message } }, { status: 400 });
  await admin.from("audit_events").insert({ actor_id: session.userId, event_type: "staff.invited", entity_type: "staff_profile", entity_id: data.user.id, metadata: { role: parsed.data.role } });
  revalidateTag("public-catalog", { expire: 0 });
  return Response.json({ data: { userId: data.user.id, invited: true } }, { status: 201 });
}
