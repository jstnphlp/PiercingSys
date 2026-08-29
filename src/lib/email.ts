import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function deliverBookingEmail(deliveryId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: delivery } = await admin.from("notification_deliveries").select("*,bookings(reference,starts_at,customers(first_name),services(name))").eq("id", deliveryId).single();
  if (!delivery || delivery.status === "sent") return;
  if (!env.resendApiKey || !env.resendFrom) {
    await admin.from("notification_deliveries").update({ status: "skipped", attempts: delivery.attempts + 1, last_error: "Resend is not configured" }).eq("id", deliveryId);
    return;
  }
  const booking = delivery.bookings as unknown as { reference: string; starts_at: string; customers: { first_name: string }; services: { name: string } };
  const subject = delivery.kind === "confirmation" ? `Booking confirmed · ${booking.reference}` : delivery.kind === "reschedule" ? `Booking rescheduled · ${booking.reference}` : `Booking cancelled · ${booking.reference}`;
  const verb = delivery.kind === "cancellation" ? "cancelled" : delivery.kind === "reschedule" ? "rescheduled" : "confirmed";
  try {
    const resend = new Resend(env.resendApiKey);
    const result = await resend.emails.send({
      from: env.resendFrom, to: delivery.recipient, subject,
      html: `<div style="font-family:Arial,sans-serif;color:#30231f"><h1>Piercing Corner</h1><p>Hi ${booking.customers.first_name},</p><p>Your ${booking.services.name} appointment has been ${verb}.</p><p><strong>${new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(booking.starts_at))}</strong></p><p>Reference: ${booking.reference}</p></div>`,
    });
    if (result.error) throw new Error(result.error.message);
    await admin.from("notification_deliveries").update({ status: "sent", attempts: delivery.attempts + 1, provider_id: result.data?.id, sent_at: new Date().toISOString(), last_error: null }).eq("id", deliveryId);
  } catch (error) {
    await admin.from("notification_deliveries").update({ status: "failed", attempts: delivery.attempts + 1, last_error: error instanceof Error ? error.message : "Unknown delivery error" }).eq("id", deliveryId);
  }
}
