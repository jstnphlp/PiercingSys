"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, type ReactNode } from "react";
import { SWRConfig, useSWRConfig } from "swr";

export const WORKSPACE_REFRESH_EVENT = "piercing-workspace-refresh";

export function requestWorkspaceRefresh() {
  window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Workspace data could not be loaded.");
  return body;
}

export function WorkspaceRefreshProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{
      fetcher: fetchJson,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2_000,
      focusThrottleInterval: 5_000,
    }}>
      <RefreshCoordinator>{children}</RefreshCoordinator>
    </SWRConfig>
  );
}

function RefreshCoordinator({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const view = searchParams.get("view") ?? "overview";
  const refresh = useCallback(() => {
    void mutate(() => true);
    router.refresh();
  }, [mutate, router]);
  const emitRefresh = useCallback(() => {
    window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
  }, []);

  useEffect(() => {
    function onRefresh() { refresh(); }
    function onVisibility() {
      if (document.visibilityState === "visible") emitRefresh();
    }
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    window.addEventListener("online", emitRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
      window.removeEventListener("online", emitRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [emitRefresh, refresh]);

  useEffect(() => {
    if (view === "settings") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") emitRefresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [emitRefresh, view]);

  return children;
}
