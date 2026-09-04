import { afterEach, describe, expect, it, vi } from "vitest";
import { measureServerTiming } from "@/lib/server-timing";

describe("measureServerTiming", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("writes production timing as label-only structured server data", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      measureServerTiming("auth.session.total", async () => "resolved"),
    ).resolves.toBe("resolved");

    expect(info).toHaveBeenCalledOnce();
    const entry = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(Object.keys(entry).sort()).toEqual(["durationMs", "event", "label"]);
    expect(entry).toMatchObject({
      event: "server-timing",
      label: "auth.session.total",
    });
    expect(entry.durationMs).toEqual(expect.any(Number));
  });

  it("does not add timing logs to test runs", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await measureServerTiming("auth.session.total", async () => null);

    expect(info).not.toHaveBeenCalled();
  });
});
