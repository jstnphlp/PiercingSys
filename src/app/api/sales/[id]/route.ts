import { z } from "zod";
import { getStaffSession, hasRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve_price"), itemId: z.string().uuid(), unitPriceCents: z.number().int().min(0) }),
  z.object({
    action: z.literal("add_payment"),
    method: z.enum(["cash", "gcash", "maya", "bank_transfer", "card", "other"]),
    amountCents: z.number().int().positive(),
    reference: z.string().trim().max(120).nullable().optional(),
  }),
  z.object({ action: z.literal("complete") }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  if (!hasRole(session.role, ["owner", "manager"])) return Response.json({ error: { code: "FORBIDDEN", message: "Sales are limited to management." } }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const sale = await supabase!.from("sales").select("id,status,total_cents,payments(amount_cents)").eq("id", id).single();
  if (!sale.data || sale.data.status !== "draft") return Response.json({ error: { code: "SALE_NOT_DRAFT", message: "Only draft sales can be changed." } }, { status: 422 });

  if (parsed.data.action === "resolve_price") {
    const item = await supabase!.from("sale_items").select("id,min_price_cents,max_price_cents,unit_price_cents").eq("id", parsed.data.itemId).eq("sale_id", id).single();
    if (!item.data) return Response.json({ error: { code: "ITEM_NOT_FOUND", message: "Sale item not found." } }, { status: 404 });
    if (item.data.min_price_cents == null || item.data.max_price_cents == null ||
        parsed.data.unitPriceCents < item.data.min_price_cents || parsed.data.unitPriceCents > item.data.max_price_cents) {
      return Response.json({ error: { code: "PRICE_OUT_OF_RANGE", message: "Enter a price within the appointment’s snapshotted range." } }, { status: 422 });
    }
    const update = await supabase!.from("sale_items").update({ unit_price_cents: parsed.data.unitPriceCents }).eq("id", parsed.data.itemId).eq("sale_id", id);
    if (update.error) return Response.json({ error: { code: "UPDATE_FAILED", message: update.error.message } }, { status: 400 });
  } else if (parsed.data.action === "add_payment") {
    const paid = (sale.data.payments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    if (paid + parsed.data.amountCents > sale.data.total_cents) return Response.json({ error: { code: "OVERPAYMENT", message: "Payment cannot exceed the remaining balance." } }, { status: 422 });
    const insert = await supabase!.from("payments").insert({
      sale_id: id, method: parsed.data.method, amount_cents: parsed.data.amountCents,
      reference: parsed.data.reference ?? null, received_by: session.userId,
    });
    if (insert.error) return Response.json({ error: { code: "PAYMENT_FAILED", message: insert.error.message } }, { status: 400 });
  } else {
    const completion = await supabase!.rpc("complete_draft_sale", { p_sale_id: id });
    if (completion.error) {
      const message = completion.error.message.includes("pricing_required") ? "Set every service price before completing the sale."
        : completion.error.message.includes("balance_due") ? "Record payment for the remaining balance before completing the sale."
        : completion.error.message;
      return Response.json({ error: { code: "COMPLETION_FAILED", message } }, { status: 422 });
    }
  }
  return Response.json({ data: { updated: true } });
}
