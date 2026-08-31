import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import type { StaffRole } from "@/lib/domain";

export const staffViews = [
  "overview",
  "calendar",
  "clients",
  "sales",
  "reports",
  "settings",
] as const;

export type StaffView = (typeof staffViews)[number];

export const managementViews: StaffView[] = [...staffViews];
export const piercerViews: StaffView[] = ["overview", "calendar", "clients"];

export function allowedViews(role: StaffRole) {
  return role === "piercer" ? piercerViews : managementViews;
}

export function resolveStaffView(value: string | undefined, role: StaffRole): StaffView {
  const requested = staffViews.includes(value as StaffView) ? value as StaffView : "overview";
  return allowedViews(role).includes(requested) ? requested : "overview";
}

export function staffViewTitle(view: StaffView) {
  return view === "overview" ? "Today at the corner" : view[0].toUpperCase() + view.slice(1);
}

export function staffViewIcon(view: StaffView) {
  if (view === "calendar") return <CalendarDays />;
  if (view === "clients") return <UsersRound />;
  if (view === "sales") return <ShoppingBag />;
  if (view === "reports") return <BarChart3 />;
  if (view === "settings") return <Settings />;
  return <LayoutDashboard />;
}
