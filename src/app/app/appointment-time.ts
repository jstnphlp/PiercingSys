import { manilaDateTime } from "@/lib/domain";

/** Calculates an appointment endpoint from the selected Manila calendar date. */
export function appointmentEndAt(date: string, time: string, durationMinutes: number) {
  const startsAt = manilaDateTime(date, time);
  return new Date(startsAt.getTime() + durationMinutes * 60_000);
}

export function appointmentDayBoundary(date: string, time: string, durationMinutes: number) {
  const endsAt = appointmentEndAt(date, time, durationMinutes);
  const dayEnd = manilaDateTime(date, "24:00");
  return {
    endsAt,
    endsAtMidnight: endsAt.getTime() === dayEnd.getTime(),
    endsPastMidnight: endsAt > dayEnd,
  };
}
