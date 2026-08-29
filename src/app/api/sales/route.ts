import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ customerId: z.string().uuid().nullable().optional(), bookingId: z.string().uuid().nullable().optional(), discountCents: z.number().int().min(0).default(0), items: z.array(z.object({ type: z.enum(["service", "jewelry", "other"]), sourceId: z.string().uuid().nullable().optional(), description: z.string().trim().min(1).max(200), quantity: z.number().int().positive(), unitPriceCents: z.number().int().min(0), discountCents: z.number().int().min(0).default(0) })).min(1), payments: z.array(z.object({ method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]), amountCents: z.number().int().positive(), reference: z.string().trim().max(120).nullable().optional() })).default([]), complete: z.boolean().default(false) });
export async function POST(request: Request) {
  const session = await getStaffSession(); if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Sales are limited to management." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const subtotal = parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents - item.discountCents, 0); const total = Math.max(0, subtotal - parsed.data.discountCents); const paid = parsed.data.payments.reduce((sum, item) => sum + item.amountCents, 0);
  if (parsed.data.complete && paid < total) return Response.json({ error: { code: "BALANCE_DUE", message: "A completed sale must be paid in full." } }, { status: 422 });
  const supabase = await createSupabaseServerClient(); const saleResult = await supabase!.from("sales").insert({ customer_id: parsed.data.customerId ?? null, booking_id: parsed.data.bookingId ?? null, subtotal_cents: subtotal, discount_cents: parsed.data.discountCents, total_cents: total }).select("id,reference").single();
  if (saleResult.error || !saleResult.data) return Response.json({ error: { code: "CREATE_FAILED", message: saleResult.error?.message ?? "Sale could not be created." } }, { status: 400 });
  const saleId = saleResult.data.id; const items = await supabase!.from("sale_items").insert(parsed.data.items.map((item) => ({ sale_id: saleId, item_type: item.type, source_id: item.sourceId ?? null, description: item.description, quantity: item.quantity, unit_price_cents: item.unitPriceCents, discount_cents: item.discountCents })));
  if (items.error) return Response.json({ error: { code: "ITEMS_FAILED", message: items.error.message } }, { status: 400 });
  if (parsed.data.payments.length) { const payments = await supabase!.from("payments").insert(parsed.data.payments.map((item) => ({ sale_id: saleId, method: item.method, amount_cents: item.amountCents, reference: item.reference ?? null, received_by: session.userId }))); if (payments.error) return Response.json({ error: { code: "PAYMENT_FAILED", message: payments.error.message } }, { status: 400 }); }
  if (parsed.data.complete) { const completion = await supabase!.from("sales").update({ status: "completed", completed_at: new Date().toISOString(), completed_by: session.userId }).eq("id", saleId); if (completion.error) return Response.json({ error: { code: "COMPLETION_FAILED", message: completion.error.message } }, { status: 400 }); }
  return Response.json({ data: { id: saleId, reference: saleResult.data.reference, totalCents: total, balanceCents: Math.max(0, total - paid) } }, { status: 201 });
}
