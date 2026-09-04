import { StaffViewPage } from "../staff-view-page";

export const instant = true;

export default function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  return <StaffViewPage view="settings" searchParams={searchParams} />;
}
