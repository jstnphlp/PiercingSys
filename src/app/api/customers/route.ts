import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), email: z.string().trim().email(), phone: z.string().trim().min(7).max(30), notes: z.string().trim().max(2000).nullable().optional() });
export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Customer creation requires management access." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const supabase = await createSupabaseServerClient(); const { data, error } = await supabase!.from("customers").insert({ first_name: parsed.data.firstName, last_name: parsed.data.lastName, email: parsed.data.email.toLowerCase(), phone: parsed.data.phone, notes: parsed.data.notes ?? null }).select("id").single();
  if (error?.code === "23505") return Response.json({ error: { code: "CUSTOMER_EXISTS", message: "A client with this email and phone already exists." } }, { status: 409 });
  if (error) return Response.json({ error: { code: "CREATE_FAILED", message: error.message } }, { status: 400 });
  return Response.json({ data }, { status: 201 });
}
