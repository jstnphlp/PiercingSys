import type { StaffView } from "./view-config";

export const pageSnapshotMaxAge: Record<StaffView, number> = {
  overview: 0,
  calendar: 0,
  clients: 30_000,
  sales: 0,
  reports: 60_000,
  settings: 300_000,
};

const snapshotParams: Record<StaffView, readonly string[]> = {
  overview: [],
  calendar: ["date", "view", "piercer", "station"],
  clients: ["q", "page"],
  sales: ["q", "page"],
  reports: ["period", "from", "to"],
  settings: ["section"],
};

export function pageSnapshotKey(
  view: StaffView,
  params: Pick<URLSearchParams, "get">,
) {
  const path = view === "overview" ? "/app" : `/app/${view}`;
  const query = new URLSearchParams();
  for (const name of snapshotParams[view]) {
    const value = params.get(name);
    if (value) query.set(name, value);
  }
  return query.size ? `${path}?${query}` : path;
}

export function pageSnapshotKeyFromHref(view: StaffView, href: string) {
  const url = new URL(href, "https://snapshot.invalid");
  return pageSnapshotKey(view, url.searchParams);
}

export function shouldRevalidatePageSnapshot(view: StaffView, ageMs: number) {
  return ageMs >= pageSnapshotMaxAge[view];
}

export function pageSnapshotLogKey(view: StaffView, key: string) {
  const url = new URL(key, "https://snapshot.invalid");
  const safe = new URLSearchParams();
  for (const name of snapshotParams[view]) {
    if (!url.searchParams.has(name)) continue;
    if (name === "q" || name === "piercer" || name === "station") {
      safe.set(name, "set");
    } else {
      safe.set(name, url.searchParams.get(name) ?? "");
    }
  }
  return `${url.pathname}${safe.size ? `?${safe}` : ""}`;
}
