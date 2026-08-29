import { z } from "zod";

const serviceIds = z.array(z.string().uuid()).min(1).max(12).superRefine((value, context) => {
  if (new Set(value).size !== value.length) {
    context.addIssue({ code: "custom", message: "Choose each service only once." });
  }
});

export const availabilityQuerySchema = z.object({
  serviceIds: serviceIds.optional(),
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  piercerId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.serviceIds?.length || value.serviceId), { path: ["serviceIds"], message: "Choose at least one service." })
  .transform((value) => ({ ...value, serviceIds: value.serviceIds ?? [value.serviceId!] }));

export const publicBookingSchema = z.object({
  serviceIds: serviceIds.optional(),
  serviceId: z.string().uuid().optional(),
  startsAt: z.string().datetime({ offset: true }),
  preferredPiercerId: z.preprocess((value) => value === "" ? null : value, z.string().uuid().nullable().optional()),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  notes: z.string().trim().max(2000).nullable().optional(),
  ageConfirmed: z.union([z.boolean(), z.literal("true"), z.literal("on")]).transform((value) => value === true || value === "true" || value === "on").pipe(z.literal(true)),
}).refine((value) => Boolean(value.serviceIds?.length || value.serviceId), { path: ["serviceIds"], message: "Choose at least one service." })
  .transform((value) => ({ ...value, serviceIds: value.serviceIds ?? [value.serviceId!] }));

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
