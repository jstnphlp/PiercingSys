"use client";

import { usePathname } from "next/navigation";
import { StaffShellSkeleton, StaffViewSkeleton } from "./staff-skeletons";
import { staffViews, type StaffView } from "./view-config";

function viewFromPathname(pathname: string): StaffView {
  const segment = pathname.split("/").filter(Boolean)[1];
  return staffViews.includes(segment as StaffView) ? segment as StaffView : "overview";
}

export function StaffShellLoading() {
  return <StaffShellSkeleton view={viewFromPathname(usePathname())} />;
}

export function StaffRouteLoading() {
  const view = viewFromPathname(usePathname());
  return <StaffViewSkeleton view={view} label={`Loading ${view}`} />;
}
