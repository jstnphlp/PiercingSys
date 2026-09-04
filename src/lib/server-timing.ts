import "server-only";

export type ServerTimingLabel =
  | "auth.getClaims"
  | "auth.jwt.asymmetric"
  | "auth.jwt.symmetric"
  | "auth.jwt.unknown"
  | "auth.session.total"
  | "auth.staffProfile"
  | "api.customers.total"
  | "api.sales.total"
  | "api.appointments.total"
  | "staff.calendar.appointments"
  | "staff.clients.page"
  | "staff.overview.bookings"
  | "staff.overview.customerCount"
  | "staff.overview.deliveryCount"
  | "staff.overview.revenue"
  | "staff.page.calendar.total"
  | "staff.page.clients.total"
  | "staff.page.overview.total"
  | "staff.page.reports.total"
  | "staff.page.sales.total"
  | "staff.page.settings.total"
  | "staff.reference.bundle.cacheRead"
  | "staff.reference.bundle.load"
  | "staff.reports.summary"
  | "staff.sales.page"
  | "staff.settings.deliveries";

function timingEnabled() {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production";
}

function logServerTiming(label: ServerTimingLabel, startedAt: number) {
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  console.info(JSON.stringify({ event: "server-timing", label, durationMs }));
}

export function logServerTimingMarker(label: ServerTimingLabel) {
  if (!timingEnabled()) return;
  console.info(JSON.stringify({ event: "server-timing", label }));
}

export async function measureServerTiming<T>(
  label: ServerTimingLabel,
  operation: () => PromiseLike<T>,
): Promise<T> {
  if (!timingEnabled()) return operation();

  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    logServerTiming(label, startedAt);
  }
}

export function measureServerTimingGroup<
  const T extends readonly PromiseLike<unknown>[],
>(
  label: ServerTimingLabel,
  operation: () => T,
): T {
  if (!timingEnabled()) return operation();

  const startedAt = performance.now();
  let pending: T;
  try {
    pending = operation();
  } catch (error) {
    logServerTiming(label, startedAt);
    throw error;
  }

  void Promise.allSettled(pending).then(() => {
    logServerTiming(label, startedAt);
  });
  return pending;
}
