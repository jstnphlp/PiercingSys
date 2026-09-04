import { describe, expect, it } from "vitest";
import {
  pageSnapshotKey,
  pageSnapshotKeyFromHref,
  pageSnapshotLogKey,
  shouldRevalidatePageSnapshot,
} from "./page-snapshot-policy";

describe("page snapshot policy", () => {
  it("keys only the route parameters that affect each page", () => {
    const params = new URLSearchParams("q=ana&page=2&ignored=value");
    expect(pageSnapshotKey("clients", params)).toBe("/app/clients?q=ana&page=2");
    expect(pageSnapshotKey("overview", params)).toBe("/app");
  });

  it("separates every route by only its relevant state", () => {
    expect(pageSnapshotKeyFromHref("calendar", "/app/calendar?date=2026-09-04&view=day&piercer=p1&station=s1&q=ignored"))
      .toBe("/app/calendar?date=2026-09-04&view=day&piercer=p1&station=s1");
    expect(pageSnapshotKeyFromHref("sales", "/app/sales?q=PC-100&page=3&period=ignored"))
      .toBe("/app/sales?q=PC-100&page=3");
    expect(pageSnapshotKeyFromHref("reports", "/app/reports?period=custom&from=2026-09-01&to=2026-09-04&q=ignored"))
      .toBe("/app/reports?period=custom&from=2026-09-01&to=2026-09-04");
    expect(pageSnapshotKeyFromHref("settings", "/app/settings?section=hours&page=ignored"))
      .toBe("/app/settings?section=hours");
  });

  it("redacts search and staff filters from instrumentation", () => {
    expect(pageSnapshotLogKey("clients", "/app/clients?q=Ana+Reyes&page=2"))
      .toBe("/app/clients?q=set&page=2");
    expect(pageSnapshotLogKey("calendar", "/app/calendar?piercer=staff-id&station=station-id"))
      .toBe("/app/calendar?piercer=set&station=set");
  });

  it("applies the requested per-page freshness windows", () => {
    expect(shouldRevalidatePageSnapshot("overview", 0)).toBe(true);
    expect(shouldRevalidatePageSnapshot("calendar", 0)).toBe(true);
    expect(shouldRevalidatePageSnapshot("sales", 0)).toBe(true);
    expect(shouldRevalidatePageSnapshot("clients", 29_999)).toBe(false);
    expect(shouldRevalidatePageSnapshot("clients", 30_000)).toBe(true);
    expect(shouldRevalidatePageSnapshot("reports", 59_999)).toBe(false);
    expect(shouldRevalidatePageSnapshot("reports", 60_000)).toBe(true);
    expect(shouldRevalidatePageSnapshot("settings", 299_999)).toBe(false);
    expect(shouldRevalidatePageSnapshot("settings", 300_000)).toBe(true);
  });
});
