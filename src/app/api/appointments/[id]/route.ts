import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { canTransition, type BookingStatus } from "@/lib/domain";
import { deliverBookingEmail } from "@/lib/email";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({ status: z.enum(["requested", "confirmed", "completed", "rejected", "cancelled", "no_show"]).optional(), startsAt: z.string().datetime({ offset: true }).optional(), piercerId: z.string().uuid().optional(), stationId: z.string().uuid().nullable().optional() }).refine((value) => value.status || value.startsAt || value.piercerId || value.stationId !== undefined, "No changes supplied");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase!.from("bookings").select("id,status,starts_at,assigned_piercer_id,service_id,customers(email),services(duration_minutes)").eq("id", id).single();
  if (!booking) return Response.json({ error: { code: "NOT_FOUND", message: "Appointment not found or not permitted." } }, { status: 404 });
  if (session.role === "piercer" && booking.assigned_piercer_id !== session.userId) return Response.json({ error: { code: "FORBIDDEN", message: "You can only update your appointments." } }, { status: 403 });
  if (parsed.data.status && !canTransition(booking.status as BookingStatus, parsed.data.status)) return Response.json({ error: { code: "INVALID_TRANSITION", message: `A ${booking.status} appointment cannot be changed to ${parsed.data.status}.` } }, { status: 422 });
  const duration = Number((Array.isArray(booking.services) ? booking.services[0] : booking.services)?.duration_minutes ?? 0);
  const update = { ...(parsed.data.status && { status: parsed.data.status }), ...(parsed.data.startsAt && { starts_at: parsed.data.startsAt, ends_at: new Date(new Date(parsed.data.startsAt).getTime() + duration * 60_000).toISOString() }), ...(parsed.data.piercerId && { assigned_piercer_id: parsed.data.piercerId }), ...(parsed.data.stationId !== undefined && { station_id: parsed.data.stationId }), updated_at: new Date().toISOString() };
  const { error } = await supabase!.from("bookings").update(update).eq("id", id);
  if (error) { const conflict = error.code === "23P01"; return Response.json({ error: { code: conflict ? "SCHEDULE_CONFLICT" : "UPDATE_FAILED", message: conflict ? "That piercer or station is already booked." : error.message } }, { status: conflict ? 409 : 400 }); }
  const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
  const kind = parsed.data.startsAt ? "reschedule" : parsed.data.status === "cancelled" ? "cancellation" : null;
  if (kind && customer?.email) {
    const key = `${id}:${kind}:${new Date().toISOString()}`;
    const admin = createSupabaseAdminClient();
    const { data: delivery } = admin ? await admin.from("notification_deliveries").insert({ booking_id: id, kind, recipient: customer.email, idempotency_key: key }).select("id").single() : { data: null };
    if (delivery) await deliverBookingEmail(delivery.id);
  }
  return Response.json({ data: { updated: true } });
}
