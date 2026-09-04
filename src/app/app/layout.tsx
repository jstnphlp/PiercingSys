import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { getStaffSession } from "@/lib/auth";
import { Toaster } from "@/components/ui/toast";
import { StaffShell } from "./staff-shell";
import { StaffShellLoading } from "./staff-shell-loading";
import { WorkspaceRefreshProvider } from "./workspace-refresh";

export const metadata: Metadata = { title: "Studio operations" };

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<StaffShellLoading />}>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Suspense>
  );
}

async function AuthenticatedApp({ children }: { children: ReactNode }) {
  // Supabase JWT validation reads the current time, so session work must start at request time.
  await connection();
  const session = await getStaffSession();
  if (!session) redirect("/login");
  return <Toaster timeout={3_000}><WorkspaceRefreshProvider><StaffShell session={session}>{children}</StaffShell></WorkspaceRefreshProvider></Toaster>;
}
