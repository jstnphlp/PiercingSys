import { z } from "zod";

export const availabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  piercerId: z.string().uuid().optional(),
});

export const publicBookingSchema = z.object({
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  preferredPiercerId: z.preprocess((value) => value === "" ? null : value, z.string().uuid().nullable().optional()),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  notes: z.string().trim().max(2000).nullable().optional(),
  ageConfirmed: z.union([z.boolean(), z.literal("true"), z.literal("on")]).transform((value) => value === true || value === "true" || value === "on").pipe(z.literal(true)),
});

export function validationError(error: z.ZodError) {
  return { error: { code: "VALIDATION_ERROR", message: "Please review the highlighted information.", fields: error.flatten().fieldErrors } };
}

export function validateBookingPhoto(photo: { type: string; size: number } | null) {
  if (!photo) return null;
  if (!new Set(["image/jpeg", "image/png"]).has(photo.type)) return "Reference photos must be JPG or PNG.";
  if (photo.size > 5 * 1024 * 1024) return "Reference photos must be no larger than 5 MB.";
  if (photo.size < 1) return "The reference photo is empty.";
  return null;
}
