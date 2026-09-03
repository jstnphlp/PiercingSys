import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";
import { pageMeta, parsePageQuery, safeSearchTerm } from "@/lib/pagination";
import { customerDisplayContact, customerDisplayName } from "@/lib/walk-in-customer";

const schema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), email: z.string().trim().email(), phone: z.string().trim().min(7).max(30), notes: z.string().trim().max(2000).nullable().optional() });

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  const { q, page, pageSize, from, to } = parsePageQuery(new URL(request.url));
  const search = safeSearchTerm(q);
  const supabase = await createSupabaseServerClient();
  let query = supabase!.from("customer_directory")
    .select("id,first_name,last_name,email,phone,created_at,appointment_count,last_appointment_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (search) {
    const term = `*${search}*`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }
  const { data, error, count } = await query.range(from, to);
  if (error) return Response.json({ error: { code: "LOOKUP_FAILED", message: error.message } }, { status: 400 });
  return Response.json({
    data: (data ?? []).map((row) => {
      const contact = customerDisplayContact(row.email, row.phone);
      return {
        id: row.id,
        name: customerDisplayName(row.first_name, row.last_name),
        ...contact,
        createdAt: row.created_at,
        appointmentCount: Number(row.appointment_count ?? 0),
        lastActivityAt: row.last_appointment_at ?? null,
      };
    }),
    page: pageMeta(page, pageSize, count ?? 0),
  });
}
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
