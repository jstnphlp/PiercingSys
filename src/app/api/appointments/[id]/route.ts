import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { canTransition, type BookingStatus } from "@/lib/domain";
import { deliverBookingEmail } from "@/lib/email";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { validationError } from "@/lib/validation";

const schema = z.object({
  status: z.enum(["requested", "confirmed", "completed", "rejected", "cancelled", "no_show"]).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  piercerId: z.string().uuid().optional(),
  stationId: z.string().uuid().nullable().optional(),
}).refine((value) => value.status || value.startsAt || value.piercerId || value.stationId !== undefined, "No changes supplied");

export async function PATCH(request: Request, context: RouteContext<"/api/appointments/[id]">) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase!.from("bookings")
    .select("id,status,starts_at,ends_at,assigned_piercer_id,station_id,customers(email)")
    .eq("id", id).single();
  if (!booking) return Response.json({ error: { code: "NOT_FOUND", message: "Appointment not found or not permitted." } }, { status: 404 });
  if (session.role === "piercer" && booking.assigned_piercer_id !== session.userId) {
    return Response.json({ error: { code: "FORBIDDEN", message: "You can only update your appointments." } }, { status: 403 });
  }

  const value = parsed.data;
  if (value.status && !canTransition(booking.status as BookingStatus, value.status) &&
      !(booking.status === "completed" && value.status === "completed")) {
    return Response.json({ error: { code: "INVALID_TRANSITION", message: `A ${booking.status} appointment cannot be changed to ${value.status}.` } }, { status: 422 });
  }

  if (value.startsAt || value.piercerId || value.stationId !== undefined) {
    const { error } = await supabase!.rpc("reschedule_booking", {
      p_booking_id: id,
      p_starts_at: value.startsAt ?? booking.starts_at,
      p_piercer_id: value.piercerId ?? booking.assigned_piercer_id,
      p_station_id: value.stationId !== undefined ? value.stationId : booking.station_id,
    });
    if (error) return scheduleError(error);
  }

  let sale: unknown = null;
  if (value.status === "completed") {
    const result = await supabase!.rpc("complete_booking_and_create_sale", { p_booking_id: id });
    if (result.error) return Response.json({ error: { code: "COMPLETION_FAILED", message: result.error.message.replaceAll("_", " ") } }, { status: 422 });
    sale = Array.isArray(result.data) ? result.data[0] : result.data;
  } else if (value.status) {
    const { error } = await supabase!.from("bookings").update({ status: value.status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return Response.json({ error: { code: "UPDATE_FAILED", message: error.message } }, { status: 400 });
  }

  const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
  const kind = value.startsAt || value.piercerId || value.stationId !== undefined
    ? "reschedule" : value.status === "cancelled" ? "cancellation" : null;
  if (kind && customer?.email) {
    const key = `${id}:${kind}:${new Date().toISOString()}`;
    const admin = createSupabaseAdminClient();
    const { data: delivery } = admin ? await admin.from("notification_deliveries")
      .insert({ booking_id: id, kind, recipient: customer.email, idempotency_key: key }).select("id").single() : { data: null };
    if (delivery) await deliverBookingEmail(delivery.id);
  }
  return Response.json({ data: { updated: true, sale } });
}

function scheduleError(error: { code?: string; message: string }) {
  const conflict = error.code === "23P01" || error.message.includes("slot_unavailable");
  const forbidden = error.code === "42501";
  return Response.json({ error: {
    code: forbidden ? "FORBIDDEN" : conflict ? "SCHEDULE_CONFLICT" : "INVALID_SCHEDULE",
    message: forbidden ? "You cannot assign that piercer." : conflict
      ? "That piercer or station is already booked."
      : error.message.replaceAll("_", " "),
  } }, { status: forbidden ? 403 : conflict ? 409 : 422 });
}
