import { describe, expect, it } from "vitest";
import { PageSnapshotCache, type PageSnapshot } from "./page-snapshot-cache";

function snapshot(
  key = "/app/clients",
  renderedAt = 1_000,
  renderId = "render-1",
): PageSnapshot<string> {
  return {
    content: `content:${key}`,
    invalidated: false,
    key,
    renderedAt,
    renderId,
    view: "clients",
  };
}

describe("PageSnapshotCache", () => {
  it("distinguishes a cache miss from a cache hit", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    expect(cache.begin("clients", "/app/clients", 1_100).kind).toBe("miss");
    cache.capture(snapshot());

    expect(cache.begin("clients", "/app/clients", 1_200)).toMatchObject({
      kind: "hit",
      pending: { snapshot: { content: "content:/app/clients" } },
    });
  });

  it("keeps query keys separated", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot("/app/clients?q=ana&page=2"));
    cache.capture(snapshot("/app/clients?q=bea&page=2", 1_100, "render-2"));

    expect(cache.find("clients", "/app/clients?q=ana&page=2")?.content)
      .toBe("content:/app/clients?q=ana&page=2");
    expect(cache.find("clients", "/app/clients?q=bea&page=2")?.content)
      .toBe("content:/app/clients?q=bea&page=2");
  });

  it("invalidates only the requested page scopes", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot());
    cache.capture({ ...snapshot("/app/reports?period=today"), view: "reports" });

    cache.invalidate(["clients"]);

    expect(cache.find("clients", "/app/clients")?.invalidated).toBe(true);
    expect(cache.find("reports", "/app/reports?period=today")?.invalidated).toBe(false);
  });

  it("clears page and client-owned data when the session changes", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot());
    cache.writeData("clients", "/app/clients", { page: 2 });

    expect(cache.resetSession("session-2")).toBe(true);
    expect(cache.find("clients", "/app/clients")).toBeNull();
    expect(cache.readData("/app/clients")).toBeUndefined();
  });

  it("starts only one refresh for a stale cached render", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot());
    cache.begin("clients", "/app/clients", 31_000);

    expect(cache.capture(snapshot())).toBe("refresh");
    expect(cache.capture(snapshot())).toBe("waiting");
    expect(cache.pending?.refreshStarted).toBe(true);
  });

  it("retains a stale snapshot after a timed-out refresh", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot());
    const navigation = cache.begin("clients", "/app/clients", 31_000).pending;
    cache.capture(snapshot());

    expect(cache.markTimedOut(navigation)).toBe(true);
    expect(cache.pending?.snapshot?.content).toBe("content:/app/clients");
    expect(cache.find("clients", "/app/clients")?.content).toBe("content:/app/clients");
  });

  it("retains stale content on failure but releases a first-visit miss", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.begin("clients", "/app/clients", 1_000);
    expect(cache.fail("clients", "/app/clients")).toBe("ready");
    expect(cache.pending).toBeNull();

    cache.capture(snapshot());
    cache.begin("clients", "/app/clients", 31_000);
    expect(cache.fail("clients", "/app/clients")).toBe("waiting");
    expect(cache.pending?.snapshot?.content).toBe("content:/app/clients");
  });

  it("replaces stale content only when a new render arrives", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot());
    cache.begin("clients", "/app/clients", 31_000);
    expect(cache.capture(snapshot())).toBe("refresh");

    expect(cache.capture(snapshot("/app/clients", 31_010, "render-2"))).toBe("ready");
    expect(cache.pending).toBeNull();
    expect(cache.find("clients", "/app/clients")?.renderId).toBe("render-2");
  });

  it("does not replace stale content with an incomplete streamed render", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot());
    cache.begin("clients", "/app/clients", 31_000);
    expect(cache.capture(snapshot())).toBe("refresh");

    const fresh = snapshot("/app/clients", 31_010, "render-2");
    expect(cache.capture(fresh, false)).toBe("waiting");
    expect(cache.find("clients", "/app/clients")?.renderId).toBe("render-1");
    expect(cache.pending?.snapshot?.content).toBe("content:/app/clients");

    expect(cache.complete("clients", "/app/clients", "render-2", 31_020)).toBe("ready");
    expect(cache.find("clients", "/app/clients")?.renderId).toBe("render-2");
  });

  it("captures a streamed page only after its successful completion signal", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.capture(snapshot(), false);

    expect(cache.find("clients", "/app/clients")).toBeNull();
    cache.complete("clients", "/app/clients", "render-1", 1_100);
    expect(cache.find("clients", "/app/clients")?.renderedAt).toBe(1_100);
  });

  it("handles a completion effect that runs before its parent capture effect", () => {
    const cache = new PageSnapshotCache<string>("session-1");
    cache.complete("clients", "/app/clients", "render-1", 1_100);

    cache.capture(snapshot(), false);

    expect(cache.find("clients", "/app/clients")?.renderedAt).toBe(1_100);
  });
});
