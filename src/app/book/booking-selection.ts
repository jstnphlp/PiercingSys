import { commonQualifiedPiercerIds } from "@/lib/domain";

type Piercer = { id: string; name: string };
type Assignment = { serviceId: string; staffId: string };

export const MAX_PUBLIC_BOOKING_SERVICES = 12;

export function toggleServiceSelection(
  serviceIds: string[],
  serviceId: string,
) {
  if (serviceIds.includes(serviceId)) {
    return {
      serviceIds: serviceIds.filter((id) => id !== serviceId),
      limitReached: false,
    };
  }
  if (serviceIds.length >= MAX_PUBLIC_BOOKING_SERVICES) {
    return { serviceIds, limitReached: true };
  }
  return { serviceIds: [...serviceIds, serviceId], limitReached: false };
}

export function qualifiedPiercersForServices(
  serviceIds: string[],
  piercers: Piercer[],
  assignments: Assignment[],
) {
  if (!serviceIds.length) return piercers;
  const qualifiedIds = new Set(commonQualifiedPiercerIds(serviceIds, assignments));
  return piercers.filter((piercer) => qualifiedIds.has(piercer.id));
}

export function isIncompatibleServiceSelection(
  serviceIds: string[],
  piercers: Piercer[],
  assignments: Assignment[],
) {
  return serviceIds.length > 1 && qualifiedPiercersForServices(serviceIds, piercers, assignments).length === 0;
}
