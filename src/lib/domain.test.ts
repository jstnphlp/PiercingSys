import { describe, expect, it } from "vitest";
import {
  calculateBalance,
  canNavigateToNextBookingWeek,
  canTransition,
  combinedServiceDuration,
  combinedServicePriceBounds,
  commonQualifiedPiercerIds,
  distinctServiceIds,
  formatPhp,
  formatServicePrice,
  eachManilaDate,
  generateAvailableSlots,
  generateAvailableSlotsForRange,
  hasScheduleConflict,
  isValidServiceSalePrice,
  manilaDate,
  manilaDateTime,
  manilaDayBounds,
  manilaWeekDates,
  manilaWeekday,
  servicePriceBounds,
  shiftManilaDate,
  type BookingStatus,
} from "./domain";

describe("booking state machine", () => {
  const allowed: Array<[BookingStatus, BookingStatus]> = [
    ["requested", "confirmed"],
    ["requested", "rejected"],
    ["requested", "cancelled"],
    ["confirmed", "completed"],
    ["confirmed", "cancelled"],
    ["confirmed", "no_show"],
  ];

  it("allows only the documented staff transitions", () => {
    for (const [from, to] of allowed) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(true);
    }
  });

  it("treats terminal statuses and reverse moves as illegal", () => {
    expect(canTransition("completed", "confirmed")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("rejected", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "requested")).toBe(false);
    expect(canTransition("no_show", "completed")).toBe(false);
    expect(canTransition("requested", "completed")).toBe(false);
    expect(canTransition("requested", "no_show")).toBe(false);
    expect(canTransition("confirmed", "requested")).toBe(false);
    expect(canTransition("confirmed", "confirmed")).toBe(false);
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
  it("treats a fully unpaid sale as the original total", () => {
    expect(calculateBalance(75_000, [])).toBe(75_000);
    expect(calculateBalance(0, [0])).toBe(0);
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

  it("does not invent bounds for an unpriced service", () => {
    expect(
      servicePriceBounds({
        priceCents: null,
        minPriceCents: null,
        maxPriceCents: null,
      }),
    ).toBeNull();
    expect(
      isValidServiceSalePrice(
        { priceCents: null, minPriceCents: 10000, maxPriceCents: null },
        10000,
      ),
    ).toBe(false);
    expect(
      combinedServicePriceBounds([
        { priceCents: 50000, minPriceCents: null, maxPriceCents: null },
        { priceCents: null, minPriceCents: null, maxPriceCents: null },
      ]),
    ).toEqual({ min: 50000, max: 50000 });
  });

  it("formats PHP amounts from integer centavos", () => {
    expect(formatPhp(0)).toBe("₱0");
    expect(formatPhp(1)).toBe("₱0.01");
  });
});

describe("Manila business dates", () => {
  it("rolls into the next business date at 16:00 UTC", () => {
    expect(manilaDate("2026-08-28T15:59:59.000Z")).toBe("2026-08-28");
    expect(manilaDate("2026-08-28T16:00:00.000Z")).toBe("2026-08-29");
  });

  it("builds offset-aware local datetimes and day bounds", () => {
    expect(manilaDateTime("2026-09-01", "10:00").toISOString()).toBe("2026-09-01T02:00:00.000Z");
    expect(manilaDateTime("2026-09-01", "10:00:00").toISOString()).toBe("2026-09-01T02:00:00.000Z");
    const bounds = manilaDayBounds("2026-09-01T15:59:59.000Z");
    expect(bounds.day).toBe("2026-09-01");
    expect(bounds.start).toBe("2026-08-31T16:00:00.000Z");
    expect(bounds.end).toBe("2026-09-01T16:00:00.000Z");
  });

  it("shifts calendar dates and returns Sunday-first studio weeks", () => {
    expect(shiftManilaDate("2026-09-01", 1)).toBe("2026-09-02");
    expect(shiftManilaDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(manilaWeekday("2026-08-30")).toBe(0);
    expect(manilaWeekday("2026-09-01")).toBe(2);
    expect(manilaWeekDates("2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
  });

  it("allows the final week that overlaps the booking horizon", () => {
    expect(canNavigateToNextBookingWeek("2026-10-19", "2026-08-31", 60)).toBe(true);
  });

  it("blocks the first week entirely beyond the booking horizon", () => {
    expect(canNavigateToNextBookingWeek("2026-10-26", "2026-08-31", 60)).toBe(false);
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

  it("ignores cancelled and rejected bookings but keeps requested, completed, and no-show holds", () => {
    const occupied = {
      piercerId: "p1",
      startsAt: "2026-09-01T02:00:00.000Z",
      endsAt: "2026-09-01T02:45:00.000Z",
    };
    const firstStart = "2026-09-01T02:00:00.000Z";
    expect(
      generateAvailableSlots({
        ...base,
        preferredPiercerId: "p1",
        bookings: [{ ...occupied, status: "cancelled" }],
      }).some((slot) => slot.startsAt === firstStart),
    ).toBe(true);
    expect(
      generateAvailableSlots({
        ...base,
        preferredPiercerId: "p1",
        bookings: [{ ...occupied, status: "rejected" }],
      }).some((slot) => slot.startsAt === firstStart),
    ).toBe(true);
    for (const status of ["requested", "confirmed", "completed", "no_show"] as const) {
      expect(
        generateAvailableSlots({
          ...base,
          preferredPiercerId: "p1",
          bookings: [{ ...occupied, status }],
        }).some((slot) => slot.startsAt === firstStart),
      ).toBe(false);
    }
  });

  it("excludes inactive, unqualified, and preferred-but-unavailable piercers", () => {
    expect(
      generateAvailableSlots({
        ...base,
        staff: [{ id: "p1", active: false }, { id: "p2", active: true }],
        qualifiedStaffIds: ["p1"],
      }),
    ).toEqual([]);
    expect(
      generateAvailableSlots({
        ...base,
        qualifiedStaffIds: [],
      }),
    ).toEqual([]);
    expect(
      generateAvailableSlots({
        ...base,
        preferredPiercerId: "p3",
      }),
    ).toEqual([]);
  });

  it("returns no openings on a closed day, past dates, or zero-length services", () => {
    expect(
      generateAvailableSlots({
        ...base,
        businessHours: { "2": { open: "10:00", close: "13:00", closed: true } },
      }),
    ).toEqual([]);
    expect(
      generateAvailableSlots({
        ...base,
        date: "2026-08-25",
      }),
    ).toEqual([]);
    expect(
      generateAvailableSlots({
        ...base,
        serviceDurationMinutes: 0,
      }),
    ).toEqual([]);
    expect(
      generateAvailableSlots({
        ...base,
        serviceDurationMinutes: 181,
      }),
    ).toEqual([]);
  });

  it("still offers a single slot when the service fills the studio day exactly", () => {
    const slots = generateAvailableSlots({
      ...base,
      serviceDurationMinutes: 180,
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]?.startsAt).toBe("2026-09-01T02:00:00.000Z");
    expect(slots[0]?.endsAt).toBe("2026-09-01T05:00:00.000Z");
  });

  it("clips staff availability to studio hours", () => {
    const slots = generateAvailableSlots({
      ...base,
      preferredPiercerId: "p1",
      availability: [{ staffId: "p1", weekday: 2, startsAt: "09:00", endsAt: "10:45" }],
    });
    expect(slots.map((slot) => slot.startsAt)).toEqual(["2026-09-01T02:00:00.000Z"]);
  });

  it("allows a slot that starts exactly when an earlier booking ends", () => {
    const after = generateAvailableSlots({
      ...base,
      preferredPiercerId: "p1",
      bookings: [{
        piercerId: "p1",
        startsAt: "2026-09-01T02:00:00.000Z",
        endsAt: "2026-09-01T02:30:00.000Z",
        status: "confirmed",
      }],
    });
    expect(after[0]?.startsAt).toBe("2026-09-01T02:30:00.000Z");
  });
});

describe("date ranges", () => {
  it("walks inclusive Manila calendar dates", () => {
    expect(eachManilaDate("2026-09-01", "2026-09-03")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
    const slots = generateAvailableSlotsForRange({
      from: "2026-09-01",
      to: "2026-09-02",
      serviceDurationMinutes: 45,
      bookingIntervalMinutes: 30,
      minimumLeadHours: 24,
      bookingHorizonDays: 60,
      businessHours: {
        "2": { open: "10:00", close: "13:00" },
        "3": { open: "10:00", close: "13:00" },
      },
      staff: [{ id: "p1", active: true }],
      qualifiedStaffIds: ["p1"],
      availability: [
        { staffId: "p1", weekday: 2, startsAt: "10:00", endsAt: "13:00" },
        { staffId: "p1", weekday: 3, startsAt: "10:00", endsAt: "13:00" },
      ],
      bookings: [],
      closures: [],
      now: new Date("2026-08-29T00:00:00.000Z"),
    });
    expect(slots.some((slot) => slot.startsAt.startsWith("2026-09-01"))).toBe(true);
    expect(slots.some((slot) => slot.startsAt.startsWith("2026-09-02"))).toBe(true);
  });
});

describe("multi-service qualification", () => {
  it("rejects duplicates and returns only piercers qualified for every service", () => {
    expect(distinctServiceIds(["s1", "s2"])).toBe(true);
    expect(distinctServiceIds(["s1", "s1"])).toBe(false);
    expect(distinctServiceIds([])).toBe(false);
    expect(commonQualifiedPiercerIds(["s1", "s2"], [
      { serviceId: "s1", staffId: "p1" }, { serviceId: "s2", staffId: "p1" },
      { serviceId: "s1", staffId: "p2" },
    ])).toEqual(["p1"]);
    expect(commonQualifiedPiercerIds(["s1", "s1"], [
      { serviceId: "s1", staffId: "p1" },
    ])).toEqual([]);
    expect(commonQualifiedPiercerIds(["s1"], [])).toEqual([]);
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
  it("rejects inverted candidate ranges", () => {
    expect(hasScheduleConflict(
      { piercerId: "p1", start: at("15:00"), end: at("14:00") },
      [],
    )).toBe(true);
  });
});
