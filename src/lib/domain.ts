export type StaffRole = "owner" | "manager" | "piercer";
export type BookingStatus = "requested" | "confirmed" | "completed" | "rejected" | "cancelled" | "no_show";
export type PaymentMethod = "cash" | "gcash" | "maya" | "bank_transfer" | "card" | "other";
export type SaleStatus = "draft" | "completed" | "voided";
export type ServiceCategory =
  | "Ear Piercings"
  | "Face & Body Piercings"
  | "Other Services";

export type DayHours = { open: string; close: string; closed?: boolean };

export type StudioSettings = {
  id: number;
  name: string;
  location: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  instagramUrl: string;
  timezone: "Asia/Manila";
  currency: "PHP";
  businessHours: Record<string, DayHours>;
  bookingIntervalMinutes: number;
  minimumLeadHours: number;
  bookingHorizonDays: number;
  minimumAge: number;
  cancellationPolicy: string | null;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  bodyArea: string | null;
  category: ServiceCategory;
  durationMinutes: number;
  priceCents: number | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  priceUnit: string | null;
  isActive: boolean;
};

export type AvailableSlot = { startsAt: string; endsAt: string; piercerIds: string[] };

export type PublicBookingInput = {
  serviceId: string;
  startsAt: string;
  preferredPiercerId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string | null;
  ageConfirmed: boolean;
};

export type PublicBookingResult = {
  id: string;
  reference: string;
  status: "confirmed";
  startsAt: string;
  endsAt: string;
};

const transitions: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "rejected", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [], rejected: [], cancelled: [], no_show: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

export function calculateBalance(totalCents: number, paymentsCents: number[], refundsCents: number[] = []) {
  const paid = paymentsCents.reduce((sum, amount) => sum + amount, 0);
  const refunded = refundsCents.reduce((sum, amount) => sum + amount, 0);
  return Math.max(0, totalCents - paid + refunded);
}

export function hasScheduleConflict(
  candidate: { piercerId: string; start: Date; end: Date },
  existing: Array<{ piercerId: string; start: Date; end: Date }>,
) {
  if (candidate.end <= candidate.start) return true;
  return existing.some((slot) => slot.piercerId === candidate.piercerId && candidate.start < slot.end && candidate.end > slot.start);
}

export const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 });
export function formatPhp(cents: number) { return php.format(cents / 100); }

export function formatServicePrice(service: Pick<Service, "priceCents" | "minPriceCents" | "maxPriceCents" | "priceUnit">) {
  const amount = service.priceCents !== null
    ? formatPhp(service.priceCents)
    : service.minPriceCents !== null && service.maxPriceCents !== null
      ? `${formatPhp(service.minPriceCents)}–${formatPhp(service.maxPriceCents)}`
      : "Price unavailable";
  return service.priceUnit ? `${amount} ${service.priceUnit}` : amount;
}

export function servicePriceBounds(service: Pick<Service, "priceCents" | "minPriceCents" | "maxPriceCents">) {
  if (service.priceCents !== null) return { min: service.priceCents, max: service.priceCents };
  if (service.minPriceCents !== null && service.maxPriceCents !== null) {
    return { min: service.minPriceCents, max: service.maxPriceCents };
  }
  return null;
}

export function isValidServiceSalePrice(
  service: Pick<Service, "priceCents" | "minPriceCents" | "maxPriceCents">,
  priceCents: number,
) {
  const bounds = servicePriceBounds(service);
  return Boolean(bounds && priceCents >= bounds.min && priceCents <= bounds.max);
}

export function manilaDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(typeof date === "string" ? new Date(date) : date);
}

export function manilaDateTime(date: string, time: string) {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`);
}

type SlotStaff = { id: string; active: boolean };
type Availability = { staffId: string; weekday: number; startsAt: string; endsAt: string };
type Occupied = { piercerId: string; startsAt: string; endsAt: string; status?: BookingStatus };
type Closure = { startsAt: string; endsAt: string };

export function generateAvailableSlots(input: {
  date: string;
  serviceDurationMinutes: number;
  bookingIntervalMinutes: number;
  minimumLeadHours: number;
  bookingHorizonDays: number;
  businessHours: Record<string, DayHours>;
  staff: SlotStaff[];
  qualifiedStaffIds: string[];
  availability: Availability[];
  bookings: Occupied[];
  closures: Closure[];
  preferredPiercerId?: string | null;
  now?: Date;
}): AvailableSlot[] {
  const now = input.now ?? new Date();
  const dayStart = manilaDateTime(input.date, "00:00");
  const horizon = new Date(now.getTime() + input.bookingHorizonDays * 86_400_000);
  if (dayStart < new Date(`${manilaDate(now)}T00:00:00+08:00`) || dayStart > horizon) return [];
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  const studioHours = input.businessHours[String(weekday)];
  if (!studioHours || studioHours.closed) return [];
  const leadCutoff = new Date(now.getTime() + input.minimumLeadHours * 3_600_000);
  const qualified = new Set(input.qualifiedStaffIds);
  const staffIds = input.staff.filter((person) => person.active && qualified.has(person.id)).map((person) => person.id)
    .filter((id) => !input.preferredPiercerId || id === input.preferredPiercerId);
  const byStart = new Map<number, AvailableSlot>();
  for (const staffId of staffIds) {
    for (const block of input.availability.filter((item) => item.staffId === staffId && item.weekday === weekday)) {
      const opens = Math.max(manilaDateTime(input.date, studioHours.open).getTime(), manilaDateTime(input.date, block.startsAt.slice(0, 5)).getTime());
      const closes = Math.min(manilaDateTime(input.date, studioHours.close).getTime(), manilaDateTime(input.date, block.endsAt.slice(0, 5)).getTime());
      const intervalMs = input.bookingIntervalMinutes * 60_000;
      const durationMs = input.serviceDurationMinutes * 60_000;
      for (let start = opens; start + durationMs <= closes; start += intervalMs) {
        const end = start + durationMs;
        if (start < leadCutoff.getTime()) continue;
        const overlapsClosure = input.closures.some((item) => start < new Date(item.endsAt).getTime() && end > new Date(item.startsAt).getTime());
        const overlapsBooking = input.bookings.some((item) => item.piercerId === staffId && item.status !== "cancelled" && item.status !== "rejected" && start < new Date(item.endsAt).getTime() && end > new Date(item.startsAt).getTime());
        if (overlapsClosure || overlapsBooking) continue;
        const existing = byStart.get(start);
        if (existing && !existing.piercerIds.includes(staffId)) existing.piercerIds.push(staffId);
        else byStart.set(start, { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), piercerIds: [staffId] });
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
