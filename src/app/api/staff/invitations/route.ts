import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { invalidateCatalogAndStaffReferenceData } from "@/lib/cache-invalidation";
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
  let invitedUserId = data?.user?.id ?? null;
  if (!invitedUserId && error) {
    // Supabase rejects invitations for an email that already has an Auth
    // account. Reuse that account so the owner can still add it to the team.
    const alreadyRegistered = /already (been )?registered|already exists|user.+exist/i.test(error.message);
    if (alreadyRegistered) {
      const existing = await admin.rpc("auth_user_id_by_email", { p_email: parsed.data.email });
      if (typeof existing.data === "string") invitedUserId = existing.data;
    }
    if (!invitedUserId) {
      const rateLimited = /rate limit|too many requests|email.+limit/i.test(error.message);
      return Response.json({ error: { code: rateLimited ? "INVITE_RATE_LIMITED" : "INVITE_FAILED", message: rateLimited
        ? "Supabase email rate limit exceeded. Wait for the quota to reset or configure a custom SMTP provider in Authentication → SMTP."
        : error.message || "Supabase could not send the invitation. Check Authentication → SMTP settings and try again." } }, { status: rateLimited ? 429 : 503 });
    }
  }
  if (!invitedUserId) return Response.json({ error: { code: "INVITE_FAILED", message: "Supabase could not create the invited user." } }, { status: 503 });
  const profile = await admin.from("staff_profiles").upsert({ user_id: invitedUserId, display_name: parsed.data.displayName, role: parsed.data.role, active: true });
  if (profile.error) return Response.json({ error: { code: "PROFILE_FAILED", message: profile.error.message } }, { status: 400 });
  await admin.from("audit_events").insert({ actor_id: session.userId, event_type: "staff.invited", entity_type: "staff_profile", entity_id: invitedUserId, metadata: { role: parsed.data.role } });
  invalidateCatalogAndStaffReferenceData();
  return Response.json({ data: { userId: invitedUserId, invited: Boolean(data?.user) } }, { status: 201 });
}
