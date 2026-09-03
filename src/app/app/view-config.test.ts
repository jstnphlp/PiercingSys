import { describe, expect, it } from "vitest";
import { legacyStaffViewUrl, staffViewFromPathname, staffViewPath } from "./view-config";

describe("staff view routes", () => {
  it("maps workspace views to canonical paths", () => {
    expect(staffViewPath("overview")).toBe("/app");
    expect(staffViewPath("calendar")).toBe("/app/calendar");
    expect(staffViewFromPathname("/app/reports", "manager")).toBe("reports");
  });

  it("falls back to overview for a forbidden role route", () => {
    expect(staffViewFromPathname("/app/sales", "piercer")).toBe("overview");
  });

  it("preserves supported query values in legacy redirects", () => {
    expect(legacyStaffViewUrl({
      view: "reports",
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-07",
    })).toBe("/app/reports?period=custom&from=2026-09-01&to=2026-09-07");
    expect(legacyStaffViewUrl({ view: "unknown", q: "Ana Cruz", page: "2" }))
      .toBe("/app?q=Ana+Cruz&page=2");
  });
});
