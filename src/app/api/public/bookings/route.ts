import { queueBookingSideEffects } from "@/lib/booking-side-effects";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { publicBookingSchema, validateBookingPhoto, validationError } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ error: { code: "NOT_CONFIGURED", message: "Online booking is still being set up." } }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: { code: "INVALID_FORM", message: "The booking form could not be read." } }, { status: 400 }); }
  const photoValue = form.get("photo");
  const photo = photoValue instanceof File && photoValue.size > 0 ? photoValue : null;
  const photoError = validateBookingPhoto(photo);
  if (photoError) {
    return Response.json({ error: { code: "INVALID_PHOTO", message: photoError, fields: { photo: [photoError] } } }, { status: 422 });
  }
  const legacyServiceId = form.get("serviceId");
  const selectedServiceIds = form.getAll("serviceIds").map(String).filter(Boolean);
  const parsed = publicBookingSchema.safeParse({
    ...Object.fromEntries([...form.entries()].filter(([key]) => key !== "photo" && key !== "serviceIds")),
    serviceIds: selectedServiceIds.length
      ? selectedServiceIds
      : legacyServiceId ? [String(legacyServiceId)] : [],
  });
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  const input = parsed.data;
  const { data, error } = await admin.rpc("create_public_booking", {
    p_service_ids: input.serviceIds,
    p_starts_at: input.startsAt,
    p_preferred_piercer_id: input.preferredPiercerId ?? null,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_phone: input.phone,
    p_notes: input.notes ?? "",
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) {
    const conflict = error.code === "23P01" || error.message.includes("slot_unavailable");
    const setup = error.message.includes("booking_not_configured");
    return Response.json({ error: { code: conflict ? "SLOT_UNAVAILABLE" : setup ? "NOT_CONFIGURED" : "BOOKING_FAILED", message: conflict ? "That opening was just booked. Please choose another time." : setup ? "Online booking is still being set up." : "We could not confirm this booking. Please try again." } }, { status: conflict ? 409 : setup ? 503 : 400 });
  }
  const booking = Array.isArray(data) ? data[0] : data;
  if (!booking) return Response.json({ error: { code: "BOOKING_FAILED", message: "The booking was not created." } }, { status: 500 });
  const photoPayload = photo
    ? { bytes: await photo.arrayBuffer(), type: photo.type, size: photo.size }
    : null;
  const { data: delivery } = await admin.from("notification_deliveries").select("id").eq("booking_id", booking.id).eq("kind", "confirmation").maybeSingle();
  queueBookingSideEffects({ bookingId: booking.id, deliveryId: delivery?.id, photo: photoPayload });
  return Response.json({ data: { id: booking.id, reference: booking.reference, status: "confirmed", startsAt: booking.starts_at, endsAt: booking.ends_at } }, { status: 201 });
}
