import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).nullable().optional(), bodyArea: z.string().trim().max(120).nullable().optional(), durationMinutes: z.number().int().min(5).max(480), priceCents: z.number().int().min(0), active: z.boolean().default(true), staffIds: z.array(z.string().uuid()).default([]) });
export async function POST(request: Request) {
  const session = await getStaffSession(); if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Service changes require management access." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const supabase = await createSupabaseServerClient(); const { data, error } = await supabase!.from("services").insert({ name: parsed.data.name, description: parsed.data.description ?? null, body_area: parsed.data.bodyArea ?? null, duration_minutes: parsed.data.durationMinutes, price_cents: parsed.data.priceCents, active: parsed.data.active }).select("id").single();
  if (error) return Response.json({ error: { code: "CREATE_FAILED", message: error.message } }, { status: 400 });
  if (parsed.data.staffIds.length) { const assignment = await supabase!.from("service_staff").insert(parsed.data.staffIds.map((staffId) => ({ service_id: data.id, staff_id: staffId }))); if (assignment.error) return Response.json({ error: { code: "ASSIGNMENT_FAILED", message: assignment.error.message } }, { status: 400 }); }
  return Response.json({ data }, { status: 201 });
}
