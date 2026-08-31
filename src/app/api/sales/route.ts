import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  bookingId: z.string().uuid().nullable().optional(),
  discountCents: z.number().int().min(0).default(0),
  items: z
    .array(
      z.object({
        type: z.enum(["service", "jewelry", "other"]),
        sourceId: z.string().uuid().nullable().optional(),
        description: z.string().trim().min(1).max(200),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int().min(0),
        discountCents: z.number().int().min(0).default(0),
      }),
    )
    .min(1),
  payments: z
    .array(
      z.object({
        method: z.enum([
          "cash",
          "gcash",
          "maya",
          "bank_transfer",
          "card",
          "other",
        ]),
        amountCents: z.number().int().positive(),
        reference: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .default([]),
  complete: z.boolean().default(false),
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
        error: { code: "FORBIDDEN", message: "Sales are limited to management." },
      },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(validationError(parsed.error), { status: 422 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.rpc("create_sale", {
    p_customer_id: parsed.data.customerId ?? null,
    p_booking_id: parsed.data.bookingId ?? null,
    p_discount_cents: parsed.data.discountCents,
    p_items: parsed.data.items,
    p_payments: parsed.data.payments,
    p_complete: parsed.data.complete,
  });
  if (error) {
    const message = error.message;
    const code = message.includes("not_authorized")
      ? "FORBIDDEN"
      : message.includes("balance_due")
        ? "BALANCE_DUE"
        : message.includes("invalid_service_price")
          ? "INVALID_SERVICE_PRICE"
          : message.includes("service_required") || message.includes("service_unavailable")
            ? "SERVICE_REQUIRED"
            : message.includes("pricing_required")
              ? "PRICING_REQUIRED"
              : "CREATE_FAILED";
    const status = code === "FORBIDDEN" ? 403 : code === "CREATE_FAILED" ? 400 : 422;
    const text =
      code === "FORBIDDEN"
        ? "Sales are limited to management."
        : code === "BALANCE_DUE"
          ? "A completed sale must be paid in full."
          : code === "INVALID_SERVICE_PRICE"
            ? "The recorded service price must match its fixed price or fall within its configured range."
            : code === "SERVICE_REQUIRED"
              ? "Service sale items must reference a configured service."
              : message.replaceAll("_", " ");
    return Response.json({ error: { code, message: text } }, { status });
  }
  const sale = Array.isArray(data) ? data[0] : data;
  if (!sale) {
    return Response.json(
      { error: { code: "CREATE_FAILED", message: "Sale could not be created." } },
      { status: 400 },
    );
  }
  return Response.json(
    {
      data: {
        id: sale.id,
        reference: sale.reference,
        totalCents: sale.total_cents,
        balanceCents: sale.balance_cents,
      },
    },
    { status: 201 },
  );
}
