import { describe, expect, it } from "vitest";
import { layoutOverlappingAppointments, layoutOverlappingItems } from "./calendar-layout";

type Item = { id: string; starts_at: string; ends_at: string };
const item = (id: string, starts: string, ends: string): Item => ({
  id,
  starts_at: `2026-09-01T${starts}:00+08:00`,
  ends_at: `2026-09-01T${ends}:00+08:00`,
});

describe("weekly calendar overlap layout", () => {
  it("leaves unrelated appointments full width", () => {
    const result = layoutOverlappingAppointments([item("a", "10:00", "10:30"), item("b", "11:00", "11:30")]);
    expect(result.map(({ lane, laneCount }) => ({ lane, laneCount }))).toEqual([
      { lane: 0, laneCount: 1 },
      { lane: 0, laneCount: 1 },
    ]);
  });

  it("places simultaneous appointments in separate lanes", () => {
    const result = layoutOverlappingAppointments([
      item("a", "10:00", "11:30"),
      item("b", "10:15", "11:15"),
      item("c", "10:30", "11:00"),
    ]);
    expect(result.map(({ lane, laneCount }) => ({ lane, laneCount }))).toEqual([
      { lane: 0, laneCount: 3 },
      { lane: 1, laneCount: 3 },
      { lane: 2, laneCount: 3 },
    ]);
  });

  it("uses one lane count for a connected staggered overlap group", () => {
    const result = layoutOverlappingAppointments([
      item("a", "10:00", "11:00"),
      item("b", "10:30", "12:00"),
      item("c", "11:30", "13:00"),
    ]);
    expect(result.map(({ lane, laneCount }) => ({ lane, laneCount }))).toEqual([
      { lane: 0, laneCount: 2 },
      { lane: 1, laneCount: 2 },
      { lane: 0, laneCount: 2 },
    ]);
  });

  it("treats touching endpoints as non-overlapping", () => {
    const result = layoutOverlappingAppointments([item("a", "10:00", "10:30"), item("b", "10:30", "11:00")]);
    expect(result.every(({ lane, laneCount }) => lane === 0 && laneCount === 1)).toBe(true);
  });

  it("produces the same ordering and lanes for unordered input", () => {
    const chronological = [item("a", "10:00", "11:30"), item("b", "10:30", "11:00"), item("c", "12:00", "12:30")];
    const expected = layoutOverlappingAppointments(chronological).map(({ item: value, lane, laneCount }) => ({ id: value.id, lane, laneCount }));
    const actual = layoutOverlappingAppointments([...chronological].reverse()).map(({ item: value, lane, laneCount }) => ({ id: value.id, lane, laneCount }));
    expect(actual).toEqual(expected);
  });

  it("lays out recurring schedule blocks using numeric time accessors", () => {
    const blocks = [
      { id: "piercer-a", start: 600, end: 720 },
      { id: "piercer-b", start: 630, end: 690 },
      { id: "piercer-c", start: 720, end: 780 },
    ];
    const result = layoutOverlappingItems(blocks, (block) => block.start, (block) => block.end);
    expect(result.map(({ item: value, lane, laneCount }) => ({ id: value.id, lane, laneCount }))).toEqual([
      { id: "piercer-a", lane: 0, laneCount: 2 },
      { id: "piercer-b", lane: 1, laneCount: 2 },
      { id: "piercer-c", lane: 0, laneCount: 1 },
    ]);
  });
});
