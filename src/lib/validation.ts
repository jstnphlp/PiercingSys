import { z } from "zod";

const serviceIds = z.array(z.string().uuid()).min(1).max(12).superRefine((value, context) => {
  if (new Set(value).size !== value.length) {
    context.addIssue({ code: "custom", message: "Choose each service only once." });
  }
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const availabilityQuerySchema = z.object({
  serviceIds: serviceIds.optional(),
  serviceId: z.string().uuid().optional(),
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  piercerId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.serviceIds?.length || value.serviceId), { path: ["serviceIds"], message: "Choose at least one service." })
  .refine((value) => Boolean(value.date || value.from), { path: ["from"], message: "Choose a date." })
  .transform((value) => {
    const from = value.from ?? value.date!;
    const to = value.to ?? value.date ?? from;
    return { ...value, serviceIds: value.serviceIds ?? [value.serviceId!], from, to };
  })
  .refine((value) => value.to >= value.from, { path: ["to"], message: "The end date must be on or after the start date." })
  .refine((value) => {
    const from = new Date(`${value.from}T00:00:00Z`);
    const to = new Date(`${value.to}T00:00:00Z`);
    return (to.getTime() - from.getTime()) / 86_400_000 <= 14;
  }, { path: ["to"], message: "Choose a range of 14 days or less." });

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
  idempotencyKey: z.string().trim().uuid().optional(),
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
