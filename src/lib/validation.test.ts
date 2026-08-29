import { describe, expect, it } from "vitest";
import { publicBookingSchema, validateBookingPhoto } from "./validation";

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
  });
});
