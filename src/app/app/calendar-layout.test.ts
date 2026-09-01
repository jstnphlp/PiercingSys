import { describe, expect, it } from "vitest";
import { layoutOverlappingAppointments } from "./calendar-layout";

function appointment(id: string, startsAt: string, endsAt: string) {
  return { id, startsAt, endsAt };
}

describe("calendar appointment layout", () => {
  it("places two simultaneous appointments in separate columns", () => {
    const layouts = layoutOverlappingAppointments([
      appointment("a", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
      appointment("b", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
    ]);

    expect(layouts.get("a")).toEqual({ column: 0, columns: 2 });
    expect(layouts.get("b")).toEqual({ column: 1, columns: 2 });
  });

  it("keeps exactly adjacent appointments at full width", () => {
    const layouts = layoutOverlappingAppointments([
      appointment("a", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
      appointment("b", "2026-09-01T14:00:00+08:00", "2026-09-01T15:00:00+08:00"),
    ]);

    expect(layouts.get("a")).toEqual({ column: 0, columns: 1 });
    expect(layouts.get("b")).toEqual({ column: 0, columns: 1 });
  });

  it("reuses a column inside a chained overlap group", () => {
    const layouts = layoutOverlappingAppointments([
      appointment("a", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
      appointment("b", "2026-09-01T13:30:00+08:00", "2026-09-01T14:30:00+08:00"),
      appointment("c", "2026-09-01T14:00:00+08:00", "2026-09-01T15:00:00+08:00"),
    ]);

    expect(layouts.get("a")).toEqual({ column: 0, columns: 2 });
    expect(layouts.get("b")).toEqual({ column: 1, columns: 2 });
    expect(layouts.get("c")).toEqual({ column: 0, columns: 2 });
  });

  it("supports more than two simultaneous appointments", () => {
    const layouts = layoutOverlappingAppointments([
      appointment("a", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
      appointment("b", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
      appointment("c", "2026-09-01T13:00:00+08:00", "2026-09-01T14:00:00+08:00"),
    ]);

    expect([...layouts.values()]).toEqual([
      { column: 0, columns: 3 },
      { column: 1, columns: 3 },
      { column: 2, columns: 3 },
    ]);
  });
});
