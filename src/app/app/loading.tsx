"use client";

import { useSearchParams } from "next/navigation";
import { StaffViewSkeleton } from "./staff-skeletons";
import { staffViews, type StaffView } from "./view-config";

export default function Loading() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("view");
  const view: StaffView = staffViews.includes(requested as StaffView)
    ? requested as StaffView
    : "overview";
  return <StaffViewSkeleton view={view} label={`Loading ${view}`} />;
}
