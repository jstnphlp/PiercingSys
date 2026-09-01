import { describe, expect, it } from "vitest";
import { removeOverlappingSlots } from "./booking-calendar";

const slot = (startsAt: string, endsAt: string) => ({
  startsAt,
  endsAt,
  piercerIds: ["p1"],
});

describe("public booking calendar conflicts", () => {
  it("removes every stale option overlapping a newly unavailable slot", () => {
    const slots = [
      slot("2026-09-07T04:30:00.000Z", "2026-09-07T05:30:00.000Z"),
      slot("2026-09-07T05:00:00.000Z", "2026-09-07T06:00:00.000Z"),
      slot("2026-09-07T05:30:00.000Z", "2026-09-07T06:30:00.000Z"),
      slot("2026-09-07T06:00:00.000Z", "2026-09-07T07:00:00.000Z"),
    ];

    expect(removeOverlappingSlots(slots, slots[1])).toEqual([slots[3]]);
  });

  it("preserves options exactly adjacent to the unavailable interval", () => {
    const before = slot("2026-09-07T04:00:00.000Z", "2026-09-07T05:00:00.000Z");
    const unavailable = slot("2026-09-07T05:00:00.000Z", "2026-09-07T06:00:00.000Z");
    const after = slot("2026-09-07T06:00:00.000Z", "2026-09-07T07:00:00.000Z");

    expect(removeOverlappingSlots([before, unavailable, after], unavailable)).toEqual([before, after]);
  });
});
