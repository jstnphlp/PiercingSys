import { StaffViewPage } from "../staff-view-page";

export const instant = true;

export default function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  return <StaffViewPage view="clients" searchParams={searchParams} />;
}
