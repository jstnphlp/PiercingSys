import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ staffIds: z.array(z.string().uuid()) });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in is required." } },
      { status: 401 },
    );
  }
  if (!hasRole(session.role, ["owner", "manager"])) {
    return Response.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Service assignments require management access.",
        },
      },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(validationError(parsed.error), { status: 422 });
  }
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const service = await supabase!
    .from("services")
    .select("id")
    .eq("id", id)
    .single();
  if (service.error || !service.data) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Service was not found." } },
      { status: 404 },
    );
  }
  const replacement = await supabase!
    .from("service_staff")
    .delete()
    .eq("service_id", id);
  if (replacement.error) {
    return Response.json(
      {
        error: {
          code: "ASSIGNMENT_FAILED",
          message: replacement.error.message,
        },
      },
      { status: 400 },
    );
  }
  if (parsed.data.staffIds.length) {
    const insert = await supabase!.from("service_staff").insert(
      parsed.data.staffIds.map((staffId) => ({
        service_id: id,
        staff_id: staffId,
      })),
    );
    if (insert.error) {
      return Response.json(
        {
          error: { code: "ASSIGNMENT_FAILED", message: insert.error.message },
        },
        { status: 400 },
      );
    }
  }
  return Response.json({ data: { id, staffIds: parsed.data.staffIds } });
}
