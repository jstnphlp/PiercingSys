import { z } from "zod";
import { getStaffSession } from "@/lib/auth";
import { queueBookingEmail } from "@/lib/booking-side-effects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { philippineMobilePhone, validationError } from "@/lib/validation";

const createSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1).max(12),
  startsAt: z.string().datetime({ offset: true }),
  piercerId: z.string().uuid(),
  stationId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254),
    phone: philippineMobilePhone,
  }).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  sendConfirmation: z.boolean().default(true),
}).superRefine((value, context) => {
  if (new Set(value.serviceIds).size !== value.serviceIds.length) {
    context.addIssue({ code: "custom", path: ["serviceIds"], message: "Choose each service only once." });
  }
  if (!value.customerId && !value.customer) {
    context.addIssue({ code: "custom", path: ["customer"], message: "Choose an existing client or add a new one." });
  }
});

function parseBoundary(value: string | null, end = false) {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T${end ? "23:59:59.999" : "00:00:00"}+08:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  const url = new URL(request.url);
  const from = parseBoundary(url.searchParams.get("from"));
  const to = parseBoundary(url.searchParams.get("to"), true);
  if (!from || !to || to <= from || to.getTime() - from.getTime() > 62 * 86_400_000) {
    return Response.json({ error: { code: "INVALID_RANGE", message: "Choose a valid calendar range of 62 days or less." } }, { status: 422 });
  }
  const requestedPiercer = url.searchParams.get("piercerId");
  const stationId = url.searchParams.get("stationId");
  if (session.role === "piercer" && requestedPiercer && requestedPiercer !== session.userId) {
    return Response.json({ error: { code: "FORBIDDEN", message: "You can only view your appointments." } }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  let query = supabase!.from("bookings").select(
    "id,reference,status,starts_at,ends_at,notes,station_id,assigned_piercer_id,customers(id,first_name,last_name,email,phone),booking_services(id,service_id,position,name,duration_minutes,price_cents,min_price_cents,max_price_cents,price_unit),staff_profiles!bookings_assigned_piercer_id_fkey(user_id,display_name,color),stations(id,name),sales(id,status)",
  ).lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()).order("starts_at");
  if (requestedPiercer) query = query.eq("assigned_piercer_id", requestedPiercer);
  if (stationId) query = query.eq("station_id", stationId);
  const { data, error } = await query;
  if (error) return Response.json({ error: { code: "LOOKUP_FAILED", message: error.message } }, { status: 400 });
  return Response.json({ data: data ?? [], meta: { timezone: "Asia/Manila", from: from.toISOString(), to: to.toISOString() } });
}

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session) return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  if (session.role === "piercer" && parsed.data.piercerId !== session.userId) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Piercers can only create appointments for themselves." } }, { status: 403 });
  }
  const value = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.rpc("create_staff_booking", {
    p_service_ids: value.serviceIds,
    p_starts_at: value.startsAt,
    p_piercer_id: value.piercerId,
    p_station_id: value.stationId ?? null,
    p_customer_id: value.customerId ?? null,
    p_first_name: value.customer?.firstName ?? "",
    p_last_name: value.customer?.lastName ?? "",
    p_email: value.customer?.email ?? "",
    p_phone: value.customer?.phone ?? "",
    p_notes: value.notes ?? "",
    p_send_confirmation: value.sendConfirmation,
  });
  if (error) {
    const conflict = error.code === "23P01" || error.message.includes("slot_unavailable");
    const forbidden = error.code === "42501";
    return Response.json({ error: {
      code: forbidden ? "FORBIDDEN" : conflict ? "SCHEDULE_CONFLICT" : "CREATE_FAILED",
      message: forbidden ? "You cannot assign that piercer." : conflict
        ? "That piercer or station is unavailable at the selected time."
        : scheduleMessage(error.message),
    } }, { status: forbidden ? 403 : conflict ? 409 : 422 });
  }
  const booking = Array.isArray(data) ? data[0] : data;
  if (booking && value.sendConfirmation) {
    const delivery = await supabase!.from("notification_deliveries").select("id").eq("booking_id", booking.id).eq("kind", "confirmation").maybeSingle();
    if (delivery.data) queueBookingEmail(delivery.data.id);
  }
  return Response.json({ data: booking }, { status: 201 });
}

function scheduleMessage(message: string) {
  const messages: Record<string, string> = {
    studio_closed: "The studio is closed on the selected date.",
    before_studio_hours: "The selected start time is before the studio opens.",
    appointment_ends_after_studio_hours: "This appointment ends after the studio's configured closing time.",
    outside_staff_availability: "The selected piercer is not available for the full appointment.",
  };
  return messages[message] ?? message.replaceAll("_", " ");
}
