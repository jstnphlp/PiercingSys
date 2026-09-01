import type { AvailableSlot } from "@/lib/domain";

export function removeOverlappingSlots(
  slots: AvailableSlot[],
  unavailable: Pick<AvailableSlot, "startsAt" | "endsAt">,
) {
  const unavailableStart = new Date(unavailable.startsAt).getTime();
  const unavailableEnd = new Date(unavailable.endsAt).getTime();
  return slots.filter((slot) => {
    const slotStart = new Date(slot.startsAt).getTime();
    const slotEnd = new Date(slot.endsAt).getTime();
    return slotStart >= unavailableEnd || slotEnd <= unavailableStart;
  });
}
