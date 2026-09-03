import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { invalidateStaffReferenceData } from "@/lib/cache-invalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ name: z.string().trim().min(1).max(80) });
export async function POST(request: Request) { const session = await getStaffSession(); if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 }); if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Station changes require management access." } }, { status: 403 }); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 }); const supabase = await createSupabaseServerClient(); const { data, error } = await supabase!.from("stations").insert({ name: parsed.data.name }).select("id").single(); if (error) return Response.json({ error: { code: "CREATE_FAILED", message: error.message } }, { status: 400 }); invalidateStaffReferenceData(); return Response.json({ data }, { status: 201 }); }
