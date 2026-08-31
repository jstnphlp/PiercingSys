import { describe, expect, it } from "vitest";
import {
  isIncompatibleServiceSelection,
  MAX_PUBLIC_BOOKING_SERVICES,
  qualifiedPiercersForServices,
  toggleServiceSelection,
} from "./booking-selection";

const piercers = [
  { id: "p1", name: "Piercer One" },
  { id: "p2", name: "Piercer Two" },
];

describe("public booking service selection", () => {
  it("detects services with no common qualified piercer", () => {
    const assignments = [
      { serviceId: "s1", staffId: "p1" },
      { serviceId: "s2", staffId: "p2" },
    ];

    expect(isIncompatibleServiceSelection(["s1", "s2"], piercers, assignments)).toBe(true);
    expect(qualifiedPiercersForServices(["s1", "s2"], piercers, assignments)).toEqual([]);
  });

  it("keeps valid multi-service selections and their common piercers", () => {
    const assignments = [
      { serviceId: "s1", staffId: "p1" },
      { serviceId: "s2", staffId: "p1" },
      { serviceId: "s1", staffId: "p2" },
    ];

    expect(isIncompatibleServiceSelection(["s1", "s2"], piercers, assignments)).toBe(false);
    expect(qualifiedPiercersForServices(["s1", "s2"], piercers, assignments)).toEqual([piercers[0]]);
  });

  it("does not label an unassigned single service as an incompatible combination", () => {
    expect(isIncompatibleServiceSelection(["s1"], piercers, [])).toBe(false);
  });

  it("adds services while the selection is below the API limit", () => {
    expect(toggleServiceSelection(["s1"], "s2")).toEqual({
      serviceIds: ["s1", "s2"],
      limitReached: false,
    });
  });

  it("keeps all existing selections when a thirteenth service is attempted", () => {
    const selected = Array.from(
      { length: MAX_PUBLIC_BOOKING_SERVICES },
      (_, index) => `s${index + 1}`,
    );
    const result = toggleServiceSelection(selected, "s13");

    expect(result).toEqual({ serviceIds: selected, limitReached: true });
    expect(result.serviceIds).toBe(selected);
  });

  it("still allows a selected service to be removed at the limit", () => {
    const selected = Array.from(
      { length: MAX_PUBLIC_BOOKING_SERVICES },
      (_, index) => `s${index + 1}`,
    );

    expect(toggleServiceSelection(selected, "s7")).toEqual({
      serviceIds: selected.filter((id) => id !== "s7"),
      limitReached: false,
    });
  });
});
