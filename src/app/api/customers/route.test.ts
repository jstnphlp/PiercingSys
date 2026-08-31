import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS, sessions } from "@/test/mocks";
import { jsonRequest, readJson } from "@/test/http";

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

import { POST } from "./route";
import { GET } from "./[id]/bookings/route";

describe("POST /api/customers", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("is limited to management", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    const { status } = await readJson(await POST(jsonRequest("http://localhost/api/customers", {
      firstName: "Ana", lastName: "Cruz", email: "ana@example.com", phone: "09170000000",
    })));
    expect(status).toBe(403);
  });

  it("stores the email in lowercase", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const insert = createQuery({ data: { id: IDS.customer }, error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => insert) });
    const { status, body } = await readJson(await POST(jsonRequest("http://localhost/api/customers", {
      firstName: " Ana ", lastName: "Cruz", email: "Ana@Example.com", phone: "09170000000",
    })));
    expect(status).toBe(201);
    expect(body).toEqual({ data: { id: IDS.customer } });
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      first_name: "Ana",
      email: "ana@example.com",
    }));
  });
});

describe("GET /api/customers/:id/bookings", () => {
  it("requires a session and maps booking rows", async () => {
    getStaffSession.mockResolvedValue(null);
    expect((await readJson(await GET(new Request("http://localhost/api/customers/x/bookings"), {
      params: Promise.resolve({ id: IDS.customer }),
    }))).status).toBe(401);

    getStaffSession.mockResolvedValue(sessions.piercer);
    const query = createQuery({
      data: [{
        id: IDS.booking,
        reference: "PC-1001",
        status: "confirmed",
        starts_at: "2026-09-01T02:00:00.000Z",
        ends_at: "2026-09-01T02:45:00.000Z",
        notes: null,
        customers: { id: IDS.customer, first_name: "Ana", last_name: "Cruz", email: "ana@example.com", phone: "0917" },
        booking_services: [{
          service_id: IDS.service, position: 1, name: "Lobe", price_cents: 50000,
          min_price_cents: null, max_price_cents: null, price_unit: null, duration_minutes: 45,
        }],
        staff_profiles: null,
        stations: null,
        sales: null,
      }],
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });
    const { status, body } = await readJson(await GET(new Request("http://localhost/api/customers/x/bookings"), {
      params: Promise.resolve({ id: IDS.customer }),
    }));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: [{ id: IDS.booking, reference: "PC-1001", customer: { name: "Ana Cruz" } }],
    });
    expect(query.eq).toHaveBeenCalledWith("customer_id", IDS.customer);
  });
});
