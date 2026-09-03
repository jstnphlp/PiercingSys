import type { CSSProperties } from "react";

export const calendarStartMinutes = 8 * 60;
export const calendarEndMinutes = 24 * 60;
export const calendarHourHeight = 60;
export const calendarHeaderHeight = 64;
export const calendarPixelsPerMinute = calendarHourHeight / 60;
export const calendarBodyHeight = (calendarEndMinutes - calendarStartMinutes) * calendarPixelsPerMinute;
export const calendarTotalHeight = calendarHeaderHeight + calendarBodyHeight;
export const calendarEndLabel = "11:59 PM";

export function calendarHourLabels() {
  const labels: Array<{ hour: number; top: number }> = [];
  for (let minutes = calendarStartMinutes; minutes < calendarEndMinutes; minutes += 60) {
    labels.push({ hour: minutes / 60, top: (minutes - calendarStartMinutes) * calendarPixelsPerMinute });
  }
  return labels;
}

export function isCalendarMinuteVisible(minutes: number) {
  return minutes >= calendarStartMinutes && minutes < calendarEndMinutes;
}

export function calendarMinuteTop(minutes: number) {
  return (minutes - calendarStartMinutes) * calendarPixelsPerMinute;
}

export function calendarEventStyle(startMinutes: number, endMinutes: number): Pick<CSSProperties, "top" | "height"> {
  const visibleStart = Math.max(calendarStartMinutes, Math.min(startMinutes, calendarEndMinutes));
  const visibleEnd = Math.max(visibleStart, Math.min(endMinutes, calendarEndMinutes));
  return {
    top: calendarMinuteTop(visibleStart),
    height: Math.max(34, (visibleEnd - visibleStart) * calendarPixelsPerMinute),
  };
}
