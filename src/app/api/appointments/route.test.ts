import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS, sessions } from "@/test/mocks";
import { jsonRequest, readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const queueBookingEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/booking-side-effects", () => ({
  queueBookingEmail,
  queueBookingSideEffects: vi.fn(),
}));

import { GET, POST } from "./route";

const createBody = {
  serviceIds: [IDS.service],
  startsAt: "2026-09-01T10:00:00+08:00",
  piercerId: IDS.piercer,
  customerId: IDS.customer,
};

describe("GET /api/appointments", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("requires a staff session", async () => {
    getStaffSession.mockResolvedValue(null);
    const { status, body } = await readJson(await GET(new Request("http://localhost/api/appointments?from=2026-09-01&to=2026-09-07")));
    expect(status).toBe(401);
    expect(body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("rejects inverted, missing, and oversized ranges", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const invalid = [
      "http://localhost/api/appointments?from=2026-09-08&to=2026-09-01",
      "http://localhost/api/appointments",
      "http://localhost/api/appointments?from=2026-01-01&to=2026-03-10",
    ];
    for (const url of invalid) {
      const { status, body } = await readJson(await GET(new Request(url)));
      expect(status).toBe(422);
      expect(body).toMatchObject({ error: { code: "INVALID_RANGE" } });
    }
  });

  it("stops a piercer from reading another piercer’s calendar", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    const { status, body } = await readJson(await GET(new Request(
      `http://localhost/api/appointments?from=2026-09-01&to=2026-09-07&piercerId=${IDS.owner}`,
    )));
    expect(status).toBe(403);
    expect(body).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns appointments in the requested Manila range", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const query = createQuery({ data: [{ id: IDS.booking, reference: "PC-1001" }], error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });
    const { status, body } = await readJson(await GET(new Request(
      "http://localhost/api/appointments?from=2026-09-01&to=2026-09-07",
    )));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: [{ id: IDS.booking }],
      meta: { timezone: "Asia/Manila" },
    });
    expect(query.lt).toHaveBeenCalled();
    expect(query.gt).toHaveBeenCalled();
  });
});

describe("POST /api/appointments", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
    queueBookingEmail.mockReset();
  });

  it("requires sign-in and a customer", async () => {
    getStaffSession.mockResolvedValue(null);
    expect((await readJson(await POST(jsonRequest("http://localhost/api/appointments", createBody)))).status).toBe(401);

    getStaffSession.mockResolvedValue(sessions.manager);
    const { status, body } = await readJson(await POST(jsonRequest("http://localhost/api/appointments", {
      ...createBody,
      customerId: undefined,
    })));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("prevents a piercer from booking another piercer", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    const { status } = await readJson(await POST(jsonRequest("http://localhost/api/appointments", {
      ...createBody,
      piercerId: IDS.owner,
    })));
    expect(status).toBe(403);
  });

  it("maps a schedule conflict to HTTP 409", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: null, error: { code: "23P01", message: "slot_unavailable" } })),
    });
    const { status, body } = await readJson(await POST(jsonRequest("http://localhost/api/appointments", createBody)));
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: { code: "SCHEDULE_CONFLICT" } });
  });

  it("explains when an appointment would end after the configured studio close", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: null, error: { code: "22007", message: "appointment_ends_after_studio_hours" } })),
    });
    const { status, body } = await readJson(await POST(jsonRequest("http://localhost/api/appointments", createBody)));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: {
      code: "CREATE_FAILED",
      message: "This appointment ends after the studio's configured closing time.",
    } });
  });

  it("creates the appointment and queues a confirmation email", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const rpc = vi.fn(async () => ({
      data: [{ id: IDS.booking, reference: "PC-1001", status: "confirmed" }],
      error: null,
    }));
    const deliveries = createQuery({ data: { id: IDS.delivery }, error: null });
    createSupabaseServerClient.mockResolvedValue({ rpc, from: vi.fn(() => deliveries) });
    const { status, body } = await readJson(await POST(jsonRequest("http://localhost/api/appointments", createBody)));
    expect(status).toBe(201);
    expect(body).toMatchObject({ data: { id: IDS.booking } });
    expect(queueBookingEmail).toHaveBeenCalledWith(IDS.delivery);
  });
});
