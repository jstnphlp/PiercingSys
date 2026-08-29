import { describe, expect, it } from "vitest";
import { calculateBalance, canTransition, hasScheduleConflict } from "./domain";

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
