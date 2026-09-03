import { describe, expect, it } from "vitest";
import { availabilityQuerySchema, isValidPhilippineMobilePhone, publicBookingSchema, validateBookingPhoto, validationError } from "./validation";
import { z } from "zod";

describe("public booking validation", () => {
  const valid = { serviceId: "20000000-0000-4000-8000-000000000001", startsAt: "2026-09-01T10:00:00+08:00", preferredPiercerId: "", firstName: "Ana", lastName: "Cruz", email: "ana@example.com", phone: "09170000000", notes: "", ageConfirmed: "on" };
  it("normalizes an empty optional piercer and age checkbox", () => {
    const result = publicBookingSchema.parse(valid);
    expect(result.preferredPiercerId).toBeNull(); expect(result.ageConfirmed).toBe(true);
    expect(result.serviceIds).toEqual([valid.serviceId]);
  });
  it("accepts distinct multi-service selections and rejects duplicates", () => {
    const services = [valid.serviceId, "20000000-0000-4000-8000-000000000002"];
    expect(publicBookingSchema.safeParse({ ...valid, serviceId: undefined, serviceIds: services }).success).toBe(true);
    expect(publicBookingSchema.safeParse({ ...valid, serviceId: undefined, serviceIds: [services[0], services[0]] }).success).toBe(false);
  });
  it("returns field validation for malformed public data", () => {
    expect(publicBookingSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...valid, ageConfirmed: false }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...valid, ageConfirmed: undefined }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...valid, startsAt: "2026-09-01T10:00:00" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...valid, serviceId: undefined, serviceIds: [] }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("accepts age confirmation variants, notes, and a valid idempotency key", () => {
    expect(publicBookingSchema.parse({ ...valid, ageConfirmed: true }).ageConfirmed).toBe(true);
    expect(publicBookingSchema.parse({ ...valid, ageConfirmed: "true" }).ageConfirmed).toBe(true);
    expect(publicBookingSchema.parse({ ...valid, notes: "  gold hoop  ", idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }).notes).toBe("gold hoop");
  });

  it("rejects more than twelve services", () => {
    const serviceIds = Array.from({ length: 13 }, (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
    expect(publicBookingSchema.safeParse({ ...valid, serviceId: undefined, serviceIds }).success).toBe(false);
    expect(publicBookingSchema.safeParse({
      ...valid,
      serviceId: undefined,
      serviceIds: serviceIds.slice(0, 12),
    }).success).toBe(true);
  });
});

describe("Philippine mobile validation", () => {
  it("accepts Philippine mobile numbers with safe formatting characters", () => {
    expect(isValidPhilippineMobilePhone("09171234567")).toBe(true);
    expect(isValidPhilippineMobilePhone("+639171234567")).toBe(true);
    expect(isValidPhilippineMobilePhone("+63 917-123-4567")).toBe(true);
  });

  it("rejects malformed contact values", () => {
    expect(isValidPhilippineMobilePhone("abcdefg")).toBe(false);
    expect(isValidPhilippineMobilePhone("123")).toBe(false);
    expect(isValidPhilippineMobilePhone("0917abc4567")).toBe(false);
    expect(isValidPhilippineMobilePhone("091712345678")).toBe(false);
  });
});

describe("availability query", () => {
  const serviceId = "20000000-0000-4000-8000-000000000001";
  it("accepts a single date and a week range", () => {
    expect(availabilityQuerySchema.parse({ serviceIds: [serviceId], date: "2026-09-01" })).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-01",
    });
    expect(availabilityQuerySchema.parse({ serviceIds: [serviceId], from: "2026-09-01", to: "2026-09-07" })).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-07",
    });
  });
  it("rejects inverted or oversized ranges", () => {
    expect(availabilityQuerySchema.safeParse({ serviceIds: [serviceId], from: "2026-09-08", to: "2026-09-01" }).success).toBe(false);
    expect(availabilityQuerySchema.safeParse({ serviceIds: [serviceId], from: "2026-09-01", to: "2026-09-20" }).success).toBe(false);
  });

  it("accepts the 14-day inclusive boundary and a legacy serviceId", () => {
    expect(availabilityQuerySchema.parse({
      serviceId,
      from: "2026-09-01",
      to: "2026-09-15",
    })).toMatchObject({ serviceIds: [serviceId], from: "2026-09-01", to: "2026-09-15" });
    expect(availabilityQuerySchema.safeParse({
      serviceIds: [serviceId],
      from: "2026-09-01",
      to: "2026-09-16",
    }).success).toBe(false);
  });

  it("requires a service and a date", () => {
    expect(availabilityQuerySchema.safeParse({ date: "2026-09-01" }).success).toBe(false);
    expect(availabilityQuerySchema.safeParse({ serviceIds: [serviceId] }).success).toBe(false);
    expect(availabilityQuerySchema.safeParse({ serviceIds: [serviceId], date: "09-01-2026" }).success).toBe(false);
  });
});

describe("booking photo restrictions", () => {
  it("accepts JPG and PNG files up to 5 MB", () => {
    expect(validateBookingPhoto({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
    expect(validateBookingPhoto({ type: "image/png", size: 1024 })).toBeNull();
  });
  it("rejects unsupported, oversized, and empty files", () => {
    expect(validateBookingPhoto({ type: "image/gif", size: 1024 })).toContain("JPG or PNG");
    expect(validateBookingPhoto({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toContain("5 MB");
    expect(validateBookingPhoto({ type: "image/png", size: 0 })).toContain("empty");
    expect(validateBookingPhoto({ type: "image/webp", size: 1024 })).toContain("JPG or PNG");
  });

  it("allows an omitted photo", () => {
    expect(validateBookingPhoto(null)).toBeNull();
  });
});

describe("validationError", () => {
  it("returns a stable API error envelope with field details", () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: "nope" });
    if (parsed.success) throw new Error("expected failure");
    expect(validationError(parsed.error)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please review the highlighted information.",
        fields: expect.objectContaining({ email: expect.any(Array) }),
      },
    });
  });
});
