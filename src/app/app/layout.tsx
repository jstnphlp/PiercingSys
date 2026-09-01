import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getStaffSession } from "@/lib/auth";
import { StaffShell } from "./staff-shell";
import { WorkspaceRefreshProvider } from "./workspace-refresh";
import "./dashboard.css";
import "./dashboard-maximalist.css";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  return <WorkspaceRefreshProvider><StaffShell session={session}>{children}</StaffShell></WorkspaceRefreshProvider>;
}
