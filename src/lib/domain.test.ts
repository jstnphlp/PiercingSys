import { describe, expect, it } from "vitest";
import {
  calculateBalance,
  canTransition,
  combinedServiceDuration,
  combinedServicePriceBounds,
  commonQualifiedPiercerIds,
  distinctServiceIds,
  formatServicePrice,
  generateAvailableSlots,
  hasScheduleConflict,
  isValidServiceSalePrice,
  manilaDate,
} from "./domain";

describe("booking state machine", () => {
  it("allows approval but prevents reopening completed work", () => {
    expect(canTransition("requested", "confirmed")).toBe(true);
    expect(canTransition("completed", "confirmed")).toBe(false);
  });
});

describe("money", () => {
  it("reconciles split payments and refunds", () => {
    expect(calculateBalance(2500, [500, 1000], [250])).toBe(1250);
  });
  it("never returns a negative balance after overpayment", () => {
    expect(calculateBalance(100_000, [120_000])).toBe(0);
  });
  it("adds immutable refund adjustments back to the balance", () => {
    expect(calculateBalance(100_000, [100_000], [25_000])).toBe(25_000);
  });
});

describe("service pricing", () => {
  it("combines durations and price ranges without inventing a range price", () => {
    const services = [
      { durationMinutes: 45, priceCents: 50000, minPriceCents: null, maxPriceCents: null },
      { durationMinutes: 30, priceCents: null, minPriceCents: 10000, maxPriceCents: 35000 },
    ];
    expect(combinedServiceDuration(services)).toBe(75);
    expect(combinedServicePriceBounds(services)).toEqual({ min: 60000, max: 85000 });
  });

  it("formats fixed and range prices without collapsing a range", () => {
    expect(
      formatServicePrice({
        priceCents: 50000,
        minPriceCents: null,
        maxPriceCents: null,
        priceUnit: null,
      }),
    ).toBe("₱500");
    expect(
      formatServicePrice({
        priceCents: null,
        minPriceCents: 20000,
        maxPriceCents: 35000,
        priceUnit: "per process",
      }),
    ).toBe("₱200–₱350 per process");
  });

  it("accepts actual range sale prices and preserves fixed prices", () => {
    const range = {
      priceCents: null,
      minPriceCents: 10000,
      maxPriceCents: 50000,
    };
    expect(isValidServiceSalePrice(range, 10000)).toBe(true);
    expect(isValidServiceSalePrice(range, 35000)).toBe(true);
    expect(isValidServiceSalePrice(range, 50001)).toBe(false);
    expect(
      isValidServiceSalePrice(
        { priceCents: 50000, minPriceCents: null, maxPriceCents: null },
        49999,
      ),
    ).toBe(false);
  });
});

describe("Manila business dates", () => {
  it("rolls into the next business date at 16:00 UTC", () => {
    expect(manilaDate("2026-08-28T15:59:59.000Z")).toBe("2026-08-28");
    expect(manilaDate("2026-08-28T16:00:00.000Z")).toBe("2026-08-29");
  });
});

describe("available slots", () => {
  const base = {
    date: "2026-09-01",
    serviceDurationMinutes: 45,
    bookingIntervalMinutes: 30,
    minimumLeadHours: 24,
    bookingHorizonDays: 60,
    businessHours: { "2": { open: "10:00", close: "13:00" } },
    staff: [{ id: "p1", active: true }, { id: "p2", active: true }],
    qualifiedStaffIds: ["p1", "p2"],
    availability: [
      { staffId: "p1", weekday: 2, startsAt: "10:00", endsAt: "13:00" },
      { staffId: "p2", weekday: 2, startsAt: "10:00", endsAt: "13:00" },
    ],
    bookings: [], closures: [], now: new Date("2026-08-29T00:00:00.000Z"),
  };
  it("uses duration and interval while grouping eligible piercers", () => {
    const slots = generateAvailableSlots(base);
    expect(slots).toHaveLength(5);
    expect(slots[0].piercerIds).toEqual(["p1", "p2"]);
    expect(new Date(slots[0].endsAt).getTime() - new Date(slots[0].startsAt).getTime()).toBe(45 * 60_000);
  });
  it("honors closures, existing bookings, and optional piercer filters", () => {
    const slots = generateAvailableSlots({ ...base, preferredPiercerId: "p1", closures: [{ startsAt: "2026-09-01T02:30:00.000Z", endsAt: "2026-09-01T03:00:00.000Z" }], bookings: [{ piercerId: "p1", startsAt: "2026-09-01T04:30:00.000Z", endsAt: "2026-09-01T05:30:00.000Z", status: "confirmed" as const }] });
    expect(slots.map((slot) => slot.startsAt)).toEqual(["2026-09-01T03:00:00.000Z", "2026-09-01T03:30:00.000Z"]);
    expect(slots.every((slot) => slot.piercerIds.length === 1 && slot.piercerIds[0] === "p1")).toBe(true);
  });
  it("enforces lead time and booking horizon", () => {
    expect(generateAvailableSlots({ ...base, now: new Date("2026-09-01T01:30:00.000Z") })).toEqual([]);
    expect(generateAvailableSlots({ ...base, bookingHorizonDays: 1 })).toEqual([]);
  });
  it("can validate staff scheduling without public lead-time or horizon rules", () => {
    expect(generateAvailableSlots({ ...base, bookingHorizonDays: 1, enforceBookingWindow: false })).not.toEqual([]);
  });
});

describe("multi-service qualification", () => {
  it("rejects duplicates and returns only piercers qualified for every service", () => {
    expect(distinctServiceIds(["s1", "s2"])).toBe(true);
    expect(distinctServiceIds(["s1", "s1"])).toBe(false);
    expect(commonQualifiedPiercerIds(["s1", "s2"], [
      { serviceId: "s1", staffId: "p1" }, { serviceId: "s2", staffId: "p1" },
      { serviceId: "s1", staffId: "p2" },
    ])).toEqual(["p1"]);
  });
});

describe("scheduling", () => {
  const at = (time: string) => new Date(`2026-08-28T${time}+08:00`);
  it("detects an overlap for the same piercer", () => {
    expect(hasScheduleConflict(
      { piercerId: "p1", start: at("14:30"), end: at("15:30") },
      [{ piercerId: "p1", start: at("14:00"), end: at("15:00") }],
    )).toBe(true);
  });
  it("permits adjacent appointments and different piercers", () => {
    const slots = [{ piercerId: "p1", start: at("14:00"), end: at("15:00") }];
    expect(hasScheduleConflict({ piercerId: "p1", start: at("15:00"), end: at("16:00") }, slots)).toBe(false);
    expect(hasScheduleConflict({ piercerId: "p2", start: at("14:30"), end: at("15:30") }, slots)).toBe(false);
  });
});
