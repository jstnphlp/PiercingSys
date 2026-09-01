export const REPORT_TIME_ZONE = "Asia/Manila";
export const MAX_REPORT_DAYS = 366;

export type ReportPreset = "today" | "this-week" | "this-month" | "last-month" | "custom";

export type ReportPeriod = {
  preset: ReportPreset;
  from: string;
  to: string;
  startUtc: string;
  endUtc: string;
  dayCount: number;
};

function dateParts(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, timestamp };
}

function isoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function manilaBusinessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function validateReportRange(from: string, to: string):
  | { ok: true; period: Omit<ReportPeriod, "preset"> }
  | { ok: false; message: string } {
  const start = dateParts(from);
  const finish = dateParts(to);
  if (!start || !finish) return { ok: false, message: "Use real dates in YYYY-MM-DD format." };
  if (finish.timestamp < start.timestamp) return { ok: false, message: "The end date must be on or after the start date." };
  const dayCount = Math.round((finish.timestamp - start.timestamp) / 86_400_000) + 1;
  if (dayCount > MAX_REPORT_DAYS) return { ok: false, message: `Report ranges cannot exceed ${MAX_REPORT_DAYS} days.` };
  return {
    ok: true,
    period: {
      from,
      to,
      startUtc: new Date(`${from}T00:00:00+08:00`).toISOString(),
      endUtc: new Date(`${isoDate(finish.timestamp + 86_400_000)}T00:00:00+08:00`).toISOString(),
      dayCount,
    },
  };
}

export function resolveReportPeriod(
  values: { period?: string; from?: string; to?: string },
  now = new Date(),
): ReportPeriod {
  const today = manilaBusinessDate(now);
  const current = dateParts(today)!;
  const requested = values.period as ReportPreset | undefined;
  let preset: ReportPreset = ["today", "this-week", "this-month", "last-month", "custom"].includes(requested ?? "")
    ? requested!
    : "this-month";
  if (values.from && values.to) {
    const stored = validateReportRange(values.from, values.to);
    if (stored.ok) return { preset, ...stored.period };
  }
  let from: string;
  let to: string;

  if (preset === "today") from = to = today;
  else if (preset === "this-week") {
    const sunday = current.timestamp - new Date(current.timestamp).getUTCDay() * 86_400_000;
    from = isoDate(sunday);
    to = isoDate(sunday + 6 * 86_400_000);
  } else if (preset === "last-month") {
    from = isoDate(Date.UTC(current.year, current.month - 2, 1));
    to = isoDate(Date.UTC(current.year, current.month - 1, 0));
  } else if (preset === "custom") {
    from = values.from ?? "";
    to = values.to ?? "";
    const custom = validateReportRange(from, to);
    if (custom.ok) return { preset, ...custom.period };
    preset = "this-month";
    from = isoDate(Date.UTC(current.year, current.month - 1, 1));
    to = today;
  } else {
    from = isoDate(Date.UTC(current.year, current.month - 1, 1));
    to = today;
  }
  const result = validateReportRange(from, to);
  if (!result.ok) throw new Error(result.message);
  return { preset, ...result.period };
}
