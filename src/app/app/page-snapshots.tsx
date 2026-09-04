"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { toast } from "@/components/ui/toast";
import {
  PageSnapshotCache,
  type CaptureResult,
  type PageSnapshot,
  type PendingNavigation,
} from "./page-snapshot-cache";
import {
  pageSnapshotKey,
  pageSnapshotKeyFromHref,
  pageSnapshotLogKey,
} from "./page-snapshot-policy";
import { StaffViewSkeleton } from "./staff-skeletons";
import { staffViews, type StaffView } from "./view-config";

const PAGE_SNAPSHOT_INVALIDATE_EVENT = "piercing-page-snapshot-invalidate";
const REVALIDATION_TIMEOUT_MS = 20_000;

type SnapshotContextValue = {
  beginNavigation: (view: StaffView, href: string) => void;
  capture: (snapshot: PageSnapshot<ReactNode>, ready: boolean) => CaptureResult;
  clear: () => void;
  complete: (view: StaffView, key: string, renderId: string) => CaptureResult;
  fail: (view: StaffView, key: string) => "ready" | "waiting" | "stored";
  find: (view: StaffView, key: string) => PageSnapshot<ReactNode> | null;
  pending: PendingNavigation<ReactNode> | null;
  readData: <T>(key: string) => T | undefined;
  writeData: <T>(view: StaffView, key: string, value: T) => void;
};

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

function logSnapshot(
  label: "pageSnapshot.hit" | "pageSnapshot.miss" | "pageSnapshot.revalidate" | "pageSnapshot.invalidate",
  view: StaffView,
  key: string,
  durationMs?: number,
  status?: "complete" | "timeout",
) {
  console.info(JSON.stringify({
    event: "page-snapshot",
    label,
    route: view === "overview" ? "/app" : `/app/${view}`,
    key: pageSnapshotLogKey(view, key),
    ...(durationMs === undefined ? {} : { durationMs: Number(durationMs.toFixed(1)) }),
    ...(status ? { status } : {}),
  }));
}

export function invalidatePageSnapshots(views: readonly StaffView[]) {
  window.dispatchEvent(new CustomEvent(PAGE_SNAPSHOT_INVALIDATE_EVENT, {
    detail: { views: [...new Set(views)] },
  }));
}

export function PageSnapshotProvider({
  children,
  sessionKey,
}: {
  children: ReactNode;
  sessionKey: string;
}) {
  const [cache] = useState(() => new PageSnapshotCache<ReactNode>(sessionKey));
  const timeoutRef = useRef<number | null>(null);
  const [pending, setPending] = useState<PendingNavigation<ReactNode> | null>(null);

  const clearTimeout = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const clear = useCallback(() => {
    clearTimeout();
    cache.clear();
    setPending(null);
  }, [cache, clearTimeout]);

  useEffect(() => clear, [clear]);

  useEffect(() => {
    function invalidate(event: Event) {
      const views = (event as CustomEvent<{ views?: StaffView[] }>).detail?.views ?? [];
      if (!views.length) return;
      const invalidated = cache.invalidate(views);
      for (const view of views) {
        const prefix = view === "overview" ? "/app" : `/app/${view}`;
        const viewSnapshots = invalidated.filter((snapshot) => snapshot.view === view);
        for (const snapshot of viewSnapshots) {
          logSnapshot("pageSnapshot.invalidate", view, snapshot.key);
        }
        if (!viewSnapshots.length) {
          logSnapshot("pageSnapshot.invalidate", view, `${prefix}?scope=all`);
        }
      }
    }
    window.addEventListener(PAGE_SNAPSHOT_INVALIDATE_EVENT, invalidate);
    return () => window.removeEventListener(PAGE_SNAPSHOT_INVALIDATE_EVENT, invalidate);
  }, [cache]);

  const find = useCallback((view: StaffView, key: string) => {
    return cache.find(view, key);
  }, [cache]);

  const readData = useCallback(<T,>(key: string) => {
    return cache.readData<T>(key);
  }, [cache]);

  const writeData = useCallback(<T,>(view: StaffView, key: string, value: T) => {
    cache.writeData(view, key, value);
  }, [cache]);

  const beginNavigation = useCallback((view: StaffView, href: string) => {
    const key = pageSnapshotKeyFromHref(view, href);
    const result = cache.begin(view, key, performance.now());
    if (result.kind === "duplicate") return;
    clearTimeout();
    const next = result.pending;
    logSnapshot(result.kind === "hit" ? "pageSnapshot.hit" : "pageSnapshot.miss", view, key);
    setPending(cache.pending);
    timeoutRef.current = window.setTimeout(() => {
      const retained = cache.markTimedOut(next);
      setPending(cache.pending);
      if (retained) {
        timeoutRef.current = null;
        logSnapshot(
          "pageSnapshot.revalidate",
          view,
          key,
          performance.now() - next.startedAt,
          "timeout",
        );
        toast.add({
          title: "Showing saved page data",
          description: "Fresh data could not be loaded yet. Your last successful view is still available.",
          type: "warning",
          timeout: 5_000,
          priority: "low",
        });
        return;
      }
    }, REVALIDATION_TIMEOUT_MS);
  }, [cache, clearTimeout]);

  const capture = useCallback((snapshot: PageSnapshot<ReactNode>, ready: boolean) => {
    const navigation = cache.pending;
    const action = cache.capture(snapshot, ready);
    setPending(cache.pending);
    if (action === "ready") clearTimeout();
    if (
      action === "ready" &&
      navigation?.previousRenderId &&
      navigation.previousRenderId !== snapshot.renderId
    ) {
      logSnapshot(
        "pageSnapshot.revalidate",
        snapshot.view,
        snapshot.key,
        performance.now() - navigation.startedAt,
        "complete",
      );
    }
    return action;
  }, [cache, clearTimeout]);

  const complete = useCallback((view: StaffView, key: string, renderId: string) => {
    const navigation = cache.pending;
    const action = cache.complete(view, key, renderId, performance.now());
    setPending(cache.pending);
    if (action === "ready") clearTimeout();
    if (
      action === "ready" &&
      navigation?.previousRenderId &&
      navigation.previousRenderId !== renderId
    ) {
      logSnapshot(
        "pageSnapshot.revalidate",
        view,
        key,
        performance.now() - navigation.startedAt,
        "complete",
      );
    }
    return action;
  }, [cache, clearTimeout]);

  const fail = useCallback((view: StaffView, key: string) => {
    const action = cache.fail(view, key);
    setPending(cache.pending);
    if (action === "ready") clearTimeout();
    return action;
  }, [cache, clearTimeout]);

  useEffect(() => {
    function onPopState() {
      const segment = window.location.pathname.split("/").filter(Boolean)[1];
      const view = segment && staffViews.includes(segment as StaffView)
        ? segment as StaffView
        : "overview";
      beginNavigation(view, window.location.href);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [beginNavigation]);

  const value = useMemo<SnapshotContextValue>(() => ({
    beginNavigation,
    capture,
    clear,
    complete,
    fail,
    find,
    pending,
    readData,
    writeData,
  }), [beginNavigation, capture, clear, complete, fail, find, pending, readData, writeData]);

  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function PageSnapshotCapture({
  children,
  ready = false,
  readySignal,
  renderId,
  view,
}: {
  children: ReactNode;
  ready?: boolean;
  readySignal?: ReactNode;
  renderId: string;
  view: StaffView;
}) {
  const context = useContext(SnapshotContext);
  const router = useRouter();
  const params = useSearchParams();
  const key = pageSnapshotKey(view, params);
  const probing = context?.pending?.view === view && context.pending.key === key;
  const capture = context?.capture;

  useEffect(() => {
    const action = capture?.({
      content: children,
      invalidated: false,
      key,
      renderedAt: performance.now(),
      renderId,
      view,
    }, ready);
    if (action === "refresh") router.refresh();
  }, [capture, children, key, ready, renderId, router, view]);

  return <>{probing ? null : children}{readySignal}</>;
}

export function PageSnapshotReady({
  renderId,
  view,
}: {
  renderId: string;
  view: StaffView;
}) {
  const context = useContext(SnapshotContext);
  const key = pageSnapshotKey(view, useSearchParams());
  const complete = context?.complete;
  useEffect(() => {
    complete?.(view, key, renderId);
  }, [complete, key, renderId, view]);
  return null;
}

export function PageSnapshotFailed({ view }: { view: StaffView }) {
  const context = useContext(SnapshotContext);
  const key = pageSnapshotKey(view, useSearchParams());
  const fail = context?.fail;
  useEffect(() => {
    fail?.(view, key);
  }, [fail, key, view]);
  return null;
}

export function PageSnapshotLoading({ view }: { view: StaffView }) {
  const context = useContext(SnapshotContext);
  const params = useSearchParams();
  const key = pageSnapshotKey(view, params);
  if (context?.pending?.view === view && context.pending.key === key) return null;
  const snapshot = context?.find(view, key);
  return snapshot?.content ?? <StaffViewSkeleton view={view} label={`Loading ${view}`} />;
}

export function PageSnapshotLink({
  view,
  ...props
}: Omit<ComponentProps<typeof Link>, "onNavigate"> & { view: StaffView }) {
  const context = useContext(SnapshotContext);
  return (
    <Link
      {...props}
      onNavigate={() => context?.beginNavigation(view, String(props.href))}
    />
  );
}

export function usePageSnapshotNavigation() {
  return useContext(SnapshotContext);
}
