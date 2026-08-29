import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const category = z.enum([
  "Ear Piercings",
  "Face & Body Piercings",
  "Other Services",
]);

const schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    bodyArea: z.string().trim().max(120).nullable().optional(),
    category,
    durationMinutes: z.number().int().min(5).max(480),
    priceCents: z.number().int().min(0).nullable().optional(),
    minPriceCents: z.number().int().min(0).nullable().optional(),
    maxPriceCents: z.number().int().min(0).nullable().optional(),
    priceUnit: z.string().trim().max(50).nullable().optional(),
    isActive: z.boolean().default(true),
    staffIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, context) => {
    const hasFixed = value.priceCents !== null && value.priceCents !== undefined;
    const hasMin =
      value.minPriceCents !== null && value.minPriceCents !== undefined;
    const hasMax =
      value.maxPriceCents !== null && value.maxPriceCents !== undefined;
    if (hasFixed === (hasMin || hasMax)) {
      context.addIssue({
        code: "custom",
        path: ["priceCents"],
        message: "Enter either a fixed price or a complete price range.",
      });
    }
    if (hasMin !== hasMax) {
      context.addIssue({
        code: "custom",
        path: ["minPriceCents"],
        message: "Both minimum and maximum prices are required for a range.",
      });
    }
    if (hasMin && hasMax && value.minPriceCents! > value.maxPriceCents!) {
      context.addIssue({
        code: "custom",
        path: ["maxPriceCents"],
        message: "Maximum price must be at least the minimum price.",
      });
    }
  });

export async function POST(request: Request) {
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
          message: "Service changes require management access.",
        },
      },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(validationError(parsed.error), { status: 422 });
  }
  const value = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!
    .from("services")
    .insert({
      name: value.name,
      description: value.description ?? null,
      body_area: value.bodyArea ?? null,
      category: value.category,
      duration_minutes: value.durationMinutes,
      price_cents: value.priceCents ?? null,
      min_price_cents: value.minPriceCents ?? null,
      max_price_cents: value.maxPriceCents ?? null,
      price_unit: value.priceUnit || null,
      is_active: value.isActive,
    })
    .select("id")
    .single();
  if (error) {
    return Response.json(
      { error: { code: "CREATE_FAILED", message: error.message } },
      { status: 400 },
    );
  }
  if (value.staffIds.length) {
    const assignment = await supabase!.from("service_staff").insert(
      value.staffIds.map((staffId) => ({
        service_id: data.id,
        staff_id: staffId,
      })),
    );
    if (assignment.error) {
      return Response.json(
        {
          error: {
            code: "ASSIGNMENT_FAILED",
            message: assignment.error.message,
          },
        },
        { status: 400 },
      );
    }
  }
  return Response.json({ data }, { status: 201 });
}
