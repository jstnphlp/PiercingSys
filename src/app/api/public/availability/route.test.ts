import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDS } from "@/test/mocks";
import { readJson } from "@/test/http";

const getAvailableSlots = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data/public", () => ({ getAvailableSlots }));

import { GET } from "./route";

describe("GET /api/public/availability", () => {
  beforeEach(() => {
    getAvailableSlots.mockReset();
  });

  it("rejects a request with no service or date", async () => {
    const { status, body } = await readJson(await GET(new Request("http://localhost/api/public/availability")));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("accepts repeated serviceIds and a week range", async () => {
    getAvailableSlots.mockResolvedValue([{
      startsAt: "2026-09-01T02:00:00.000Z",
      endsAt: "2026-09-01T02:45:00.000Z",
      piercerIds: [IDS.piercer],
    }]);
    const url = `http://localhost/api/public/availability?serviceIds=${IDS.service}&serviceIds=${IDS.service2}&from=2026-09-01&to=2026-09-07&piercerId=${IDS.piercer}`;
    const response = await GET(new Request(url));
    const { status, body } = await readJson(response);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: [{ startsAt: "2026-09-01T02:00:00.000Z" }],
      meta: { timezone: "Asia/Manila", from: "2026-09-01", to: "2026-09-07" },
    });
    expect(response.headers.get("cache-control")).toContain("max-age=5");
    expect(getAvailableSlots).toHaveBeenCalledWith({
      serviceIds: [IDS.service, IDS.service2],
      from: "2026-09-01",
      to: "2026-09-07",
      piercerId: IDS.piercer,
    });
  });

  it("accepts the legacy serviceId query and comma-separated ids", async () => {
    getAvailableSlots.mockResolvedValue([]);
    await GET(new Request(`http://localhost/api/public/availability?serviceId=${IDS.service}&date=2026-09-01`));
    expect(getAvailableSlots).toHaveBeenCalledWith(expect.objectContaining({
      serviceIds: [IDS.service],
      from: "2026-09-01",
      to: "2026-09-01",
    }));
    await GET(new Request(`http://localhost/api/public/availability?serviceIds=${IDS.service},${IDS.service2}&date=2026-09-01`));
    expect(getAvailableSlots).toHaveBeenLastCalledWith(expect.objectContaining({
      serviceIds: [IDS.service, IDS.service2],
    }));
  });

  it("returns 503 when openings cannot be loaded", async () => {
    getAvailableSlots.mockRejectedValue(new Error("timeout"));
    const { status, body } = await readJson(await GET(new Request(
      `http://localhost/api/public/availability?serviceId=${IDS.service}&date=2026-09-01`,
    )));
    expect(status).toBe(503);
    expect(body).toMatchObject({ error: { code: "AVAILABILITY_FAILED" } });
  });
});
