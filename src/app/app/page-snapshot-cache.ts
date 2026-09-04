import { shouldRevalidatePageSnapshot } from "./page-snapshot-policy";
import type { StaffView } from "./view-config";

export type PageSnapshot<T> = {
  content: T;
  invalidated: boolean;
  key: string;
  renderedAt: number;
  renderId: string;
  view: StaffView;
};

export type PendingNavigation<T> = {
  key: string;
  previousRenderId: string | null;
  revalidate: boolean;
  refreshStarted: boolean;
  snapshot: PageSnapshot<T> | null;
  startedAt: number;
  timedOut: boolean;
  view: StaffView;
};

export type CaptureResult = "refresh" | "waiting" | "ready" | "stored";

export class PageSnapshotCache<T> {
  private readonly snapshots = new Map<string, PageSnapshot<T>>();
  private readonly candidates = new Map<string, PageSnapshot<T>>();
  private readonly completions = new Map<string, { renderedAt: number; renderId: string; view: StaffView }>();
  private readonly dataSnapshots = new Map<string, { value: unknown; view: StaffView }>();
  private readonly renderIds = new Map<StaffView, string>();
  private currentSessionKey: string;

  pending: PendingNavigation<T> | null = null;

  constructor(sessionKey: string) {
    this.currentSessionKey = sessionKey;
  }

  clear() {
    this.snapshots.clear();
    this.candidates.clear();
    this.completions.clear();
    this.dataSnapshots.clear();
    this.renderIds.clear();
    this.pending = null;
  }

  resetSession(sessionKey: string) {
    if (sessionKey === this.currentSessionKey) return false;
    this.currentSessionKey = sessionKey;
    this.clear();
    return true;
  }

  find(view: StaffView, key: string) {
    const snapshot = this.snapshots.get(key);
    return snapshot?.view === view ? snapshot : null;
  }

  readData<Value>(key: string) {
    return this.dataSnapshots.get(key)?.value as Value | undefined;
  }

  writeData<Value>(view: StaffView, key: string, value: Value) {
    this.dataSnapshots.set(key, { value, view });
  }

  begin(view: StaffView, key: string, now: number) {
    if (this.pending?.key === key && !this.pending.timedOut) {
      return { kind: "duplicate" as const, pending: this.pending };
    }
    const snapshot = this.find(view, key);
    this.pending = {
      key,
      previousRenderId: snapshot?.renderId ?? null,
      revalidate: snapshot
        ? snapshot.invalidated || shouldRevalidatePageSnapshot(view, now - snapshot.renderedAt)
        : false,
      refreshStarted: false,
      snapshot,
      startedAt: now,
      timedOut: false,
      view,
    };
    return {
      kind: snapshot ? "hit" as const : "miss" as const,
      pending: this.pending,
    };
  }

  capture(snapshot: PageSnapshot<T>, ready = true): CaptureResult {
    this.candidates.set(snapshot.key, snapshot);
    const completion = this.completions.get(snapshot.key);
    const completed = completion?.view === snapshot.view &&
      completion.renderId === snapshot.renderId;
    if (ready || completed) {
      this.commit(completed ? { ...snapshot, renderedAt: completion.renderedAt } : snapshot);
      this.completions.delete(snapshot.key);
      ready = true;
    }

    const navigation = this.pending;
    if (!navigation || navigation.view !== snapshot.view || navigation.key !== snapshot.key) {
      return "stored";
    }
    if (navigation.previousRenderId === snapshot.renderId && navigation.revalidate) {
      if (navigation.refreshStarted) return "waiting";
      this.pending = { ...navigation, refreshStarted: true, timedOut: false };
      return "refresh";
    }

    if (!ready) return "waiting";

    this.pending = null;
    return "ready";
  }

  complete(view: StaffView, key: string, renderId: string, renderedAt: number): CaptureResult {
    const candidate = this.candidates.get(key);
    if (!candidate || candidate.view !== view || candidate.renderId !== renderId) {
      this.completions.set(key, { renderedAt, renderId, view });
      return "stored";
    }
    this.commit({ ...candidate, renderedAt });
    const navigation = this.pending;
    if (!navigation || navigation.view !== view || navigation.key !== key) return "stored";
    if (navigation.previousRenderId === renderId && navigation.revalidate) return "waiting";
    this.pending = null;
    return "ready";
  }

  fail(view: StaffView, key: string): "ready" | "waiting" | "stored" {
    const navigation = this.pending;
    if (!navigation || navigation.view !== view || navigation.key !== key) return "stored";
    if (navigation.snapshot) return "waiting";
    this.pending = null;
    return "ready";
  }

  private commit(snapshot: PageSnapshot<T>) {
    const activeRenderId = this.renderIds.get(snapshot.view);
    if (activeRenderId !== snapshot.renderId) {
      this.renderIds.set(snapshot.view, snapshot.renderId);
      // A fresh RSC payload is authoritative for its own route key. Other
      // client-owned query snapshots remain valid for their distinct keys.
      this.dataSnapshots.delete(snapshot.key);
    }
    const existing = this.snapshots.get(snapshot.key);
    if (!existing || existing.renderId !== snapshot.renderId) {
      this.snapshots.set(snapshot.key, snapshot);
    } else if (existing.content !== snapshot.content) {
      this.snapshots.set(snapshot.key, { ...existing, content: snapshot.content });
    }
  }

  invalidate(views: readonly StaffView[]) {
    const scopes = new Set(views);
    const invalidated: PageSnapshot<T>[] = [];
    for (const [key, snapshot] of this.snapshots) {
      if (!scopes.has(snapshot.view)) continue;
      const next = { ...snapshot, invalidated: true };
      this.snapshots.set(key, next);
      invalidated.push(next);
    }
    return invalidated;
  }

  markTimedOut(pending: PendingNavigation<T>) {
    if (this.pending !== pending && (
      this.pending?.key !== pending.key ||
      this.pending?.startedAt !== pending.startedAt
    )) return false;
    if (!this.pending?.snapshot) {
      this.pending = null;
      return false;
    }
    this.pending = { ...this.pending, timedOut: true };
    return true;
  }
}
