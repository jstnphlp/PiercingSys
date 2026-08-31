import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, sessions } from "@/test/mocks";
import { readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
  createSupabaseAdminClient: vi.fn(),
}));

import { GET } from "./route";

describe("GET /api/reports/export", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("is limited to management and valid dates", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await readJson(await GET(new Request("http://localhost/api/reports/export?from=2026-09-01&to=2026-09-07")))).status).toBe(403);

    getStaffSession.mockResolvedValue(sessions.manager);
    const { status, body } = await readJson(await GET(new Request("http://localhost/api/reports/export?from=01-09-2026&to=2026-09-07")));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "INVALID_DATES" } });
  });

  it("escapes CSV cells that contain commas, quotes, or newlines", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({
        data: [{
          reference: "S-1",
          status: "completed",
          total_cents: 150000,
          created_at: "2026-09-01T02:00:00.000Z",
          customers: { first_name: "Ana", last_name: 'Cruz, "the client"' },
          bookings: { booking_services: [{ position: 1, name: "Lobe" }, { position: 2, name: "Nostril" }] },
          payments: [{ method: "cash", amount_cents: 100000 }, { method: "gcash", amount_cents: 50000 }],
          sale_adjustments: [{ kind: "refund", amount_cents: 25000 }],
        }],
        error: null,
      })),
    });
    const response = await GET(new Request("http://localhost/api/reports/export?from=2026-09-01&to=2026-09-01"));
    expect(response.headers.get("content-type")).toContain("text/csv");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder().decode(bytes.slice(3));
    expect(csv).toContain('"Ana Cruz, ""the client"""');
    expect(csv).toContain("Lobe + Nostril");
    expect(csv).toContain("1500.00");
    expect(csv).toContain("250.00");
    expect(csv).toContain("1250.00");
    expect(csv).toContain("cash+gcash");
  });
});
