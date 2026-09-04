import { describe, expect, it } from "vitest";
import { manilaDate } from "@/lib/domain";
import { appointmentDayBoundary, appointmentEndAt } from "./appointment-time";

describe("appointment summary timing", () => {
  it("keeps a full hour when an appointment ends at the next Manila midnight", () => {
    const end = appointmentEndAt("2026-09-03", "23:00", 60);

    expect(end.toISOString()).toBe("2026-09-03T16:00:00.000Z");
    expect(manilaDate(end)).toBe("2026-09-04");
  });

  it("distinguishes the valid midnight endpoint from a cross-day appointment", () => {
    expect(appointmentDayBoundary("2026-09-03", "23:00", 60)).toMatchObject({
      endsAtMidnight: true,
      endsPastMidnight: false,
    });
    expect(appointmentDayBoundary("2026-09-03", "23:15", 60)).toMatchObject({
      endsAtMidnight: false,
      endsPastMidnight: true,
    });
  });
});
