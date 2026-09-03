import { StaffViewPage } from "../staff-view-page";

export const instant = true;

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  return <StaffViewPage view="reports" searchParams={searchParams} />;
}
