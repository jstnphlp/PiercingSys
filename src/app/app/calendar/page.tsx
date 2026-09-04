import { StaffViewPage } from "../staff-view-page";

export const instant = true;

export default function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; piercer?: string; station?: string }>;
}) {
  return <StaffViewPage view="calendar" searchParams={searchParams} />;
}
