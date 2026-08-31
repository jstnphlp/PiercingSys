import "server-only";
import { after } from "next/server";
import { deliverBookingEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type BookingPhotoPayload = { bytes: ArrayBuffer; type: string; size: number };

export function queueBookingSideEffects(input: {
  bookingId: string;
  deliveryId?: string | null;
  photo?: BookingPhotoPayload | null;
}) {
  after(async () => {
    const admin = createSupabaseAdminClient();
    if (!admin) return;
    if (input.photo) {
      const extension = input.photo.type === "image/png" ? "png" : "jpg";
      const path = `${input.bookingId}/${crypto.randomUUID()}.${extension}`;
      const upload = await admin.storage.from("booking-photos").upload(path, input.photo.bytes, {
        contentType: input.photo.type,
        upsert: false,
      });
      if (!upload.error) {
        await admin.from("booking_photos").insert({
          booking_id: input.bookingId,
          storage_path: path,
          mime_type: input.photo.type,
          size_bytes: input.photo.size,
        });
      }
    }
    if (input.deliveryId) await deliverBookingEmail(input.deliveryId);
  });
}

export function queueBookingEmail(deliveryId: string) {
  after(() => deliverBookingEmail(deliveryId));
}
