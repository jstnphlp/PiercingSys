import { permanentRedirect } from "next/navigation";
import { StaffViewPage } from "./staff-view-page";
import { legacyStaffViewUrl } from "./view-config";

type AppSearchParams = {
  view?: string;
  [key: string]: string | string[] | undefined;
};

export const instant = true;

export default function AppPage({
  searchParams,
}: {
  searchParams: Promise<AppSearchParams>;
}) {
  return <LegacyViewRedirectOrOverview searchParams={searchParams} />;
}

async function LegacyViewRedirectOrOverview({
  searchParams,
}: {
  searchParams: Promise<AppSearchParams>;
}) {
  const params = await searchParams;
  const legacyUrl = legacyStaffViewUrl(params);
  if (!legacyUrl) return <StaffViewPage view="overview" />;
  permanentRedirect(legacyUrl);
}
