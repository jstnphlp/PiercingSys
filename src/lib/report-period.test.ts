import { describe, expect, it } from "vitest";
import { resolveReportPeriod, validateReportRange } from "./report-period";

describe("report periods", () => {
  const now = new Date("2028-03-01T01:30:00.000Z");

  it("defaults to Manila month-to-date and resolves calendar presets", () => {
    expect(resolveReportPeriod({}, now)).toMatchObject({ from: "2028-03-01", to: "2028-03-01", preset: "this-month" });
    expect(resolveReportPeriod({ period: "last-month" }, now)).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
    expect(resolveReportPeriod({ period: "this-week" }, new Date("2026-01-01T04:00:00Z"))).toMatchObject({ from: "2025-12-28", to: "2026-01-03" });
  });

  it("uses inclusive Manila boundaries", () => {
    expect(resolveReportPeriod({ period: "custom", from: "2026-08-31", to: "2026-09-01" }, now)).toMatchObject({
      startUtc: "2026-08-30T16:00:00.000Z",
      endUtc: "2026-09-01T16:00:00.000Z",
      dayCount: 2,
    });
  });

  it("preserves explicit preset dates from a shared URL", () => {
    expect(resolveReportPeriod({ period: "this-month", from: "2026-01-01", to: "2026-01-15" }, now)).toMatchObject({
      preset: "this-month", from: "2026-01-01", to: "2026-01-15",
    });
  });

  it("rejects impossible, inverted, and longer than 366-day ranges", () => {
    expect(validateReportRange("2026-02-29", "2026-03-01").ok).toBe(false);
    expect(validateReportRange("2026-09-02", "2026-09-01").ok).toBe(false);
    expect(validateReportRange("2024-01-02", "2025-01-01").ok).toBe(true);
    expect(validateReportRange("2024-01-01", "2025-01-01").ok).toBe(false);
  });
});
