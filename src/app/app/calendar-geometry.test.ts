import { describe, expect, it } from "vitest";
import {
  calendarBodyHeight,
  calendarEndLabel,
  calendarEndMinutes,
  calendarEventStyle,
  calendarHourHeight,
  calendarHourLabels,
  calendarStartMinutes,
  isCalendarMinuteVisible,
} from "./calendar-geometry";

describe("calendar geometry", () => {
  it("derives a 8 AM to midnight-exclusive body height at 60px per hour", () => {
    expect(calendarStartMinutes).toBe(8 * 60);
    expect(calendarEndMinutes).toBe(24 * 60);
    expect(calendarHourHeight).toBe(60);
    expect(calendarBodyHeight).toBe(960);
  });

  it("renders hourly labels through 11 PM and presents 11:59 PM as the end marker", () => {
    const labels = calendarHourLabels();
    expect(labels.at(0)).toEqual({ hour: 8, top: 0 });
    expect(labels.at(-1)).toEqual({ hour: 23, top: 900 });
    expect(labels).toHaveLength(16);
    expect(labels.some((label) => label.hour === 24)).toBe(false);
    expect(calendarEndLabel).toBe("11:59 PM");
  });

  it("treats midnight as an exclusive internal boundary", () => {
    expect(isCalendarMinuteVisible(8 * 60)).toBe(true);
    expect(isCalendarMinuteVisible(23 * 60 + 59)).toBe(true);
    expect(isCalendarMinuteVisible(24 * 60)).toBe(false);
  });

  it("clips appointments that run past the visible end of day", () => {
    expect(calendarEventStyle(23 * 60 + 10, 24 * 60 + 30)).toEqual({
      top: 910,
      height: 50,
    });
  });

  it("clips appointments that begin before the visible start of day", () => {
    expect(calendarEventStyle(7 * 60 + 30, 8 * 60 + 15)).toEqual({
      top: 0,
      height: 34,
    });
  });
});
