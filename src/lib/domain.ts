export type BookingStatus = "requested" | "confirmed" | "completed" | "rejected" | "cancelled" | "no_show";
export type PaymentMethod = "cash" | "gcash" | "maya" | "bank_transfer" | "card" | "other";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "rejected", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [], rejected: [], cancelled: [], no_show: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus) {
  return transitions[from].includes(to);
}

export function calculateBalance(total: number, payments: number[], refunds: number[] = []) {
  const paid = payments.reduce((sum, amount) => sum + amount, 0);
  const refunded = refunds.reduce((sum, amount) => sum + amount, 0);
  return Math.max(0, total - paid + refunded);
}

export function hasScheduleConflict(
  candidate: { piercerId: string; start: Date; end: Date },
  existing: Array<{ piercerId: string; start: Date; end: Date }>,
) {
  if (candidate.end <= candidate.start) return true;
  return existing.some((slot) =>
    slot.piercerId === candidate.piercerId && candidate.start < slot.end && candidate.end > slot.start,
  );
}

export const php = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
