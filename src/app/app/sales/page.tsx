import { StaffViewPage } from "../staff-view-page";

export const instant = true;

export default function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  return <StaffViewPage view="sales" searchParams={searchParams} />;
}
