import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS, sessions } from "@/test/mocks";
import { jsonRequest, readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const createSupabaseAdminClient = vi.hoisted(() => vi.fn());
const queueBookingEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
  createSupabaseAdminClient,
}));

vi.mock("@/lib/booking-side-effects", () => ({
  queueBookingEmail,
  queueBookingSideEffects: vi.fn(),
}));

import { PATCH } from "./route";

const params = { params: Promise.resolve({ id: IDS.booking }) };
const bookingRow = {
  id: IDS.booking,
  status: "confirmed",
  starts_at: "2026-09-01T02:00:00.000Z",
  ends_at: "2026-09-01T02:45:00.000Z",
  assigned_piercer_id: IDS.piercer,
  station_id: null,
  customers: { email: "ana@example.com" },
};

describe("PATCH /api/appointments/:id", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
    createSupabaseAdminClient.mockReset();
    queueBookingEmail.mockReset();
  });

  it("requires a session and a known appointment", async () => {
    getStaffSession.mockResolvedValue(null);
    expect((await readJson(await PATCH(jsonRequest("http://localhost/api/appointments/x", { status: "cancelled" }), params))).status).toBe(401);

    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: null, error: null })),
    });
    const { status, body } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/appointments/x", { status: "cancelled" }),
      params,
    ));
    expect(status).toBe(404);
    expect(body).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("stops a piercer from updating someone else’s appointment", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({
        data: { ...bookingRow, assigned_piercer_id: IDS.owner },
        error: null,
      })),
    });
    const { status } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/appointments/x", { status: "completed" }),
      params,
    ));
    expect(status).toBe(403);
  });

  it("rejects illegal status transitions", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: { ...bookingRow, status: "completed" }, error: null })),
    });
    const { status, body } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/appointments/x", { status: "cancelled" }),
      params,
    ));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "INVALID_TRANSITION" } });
  });

  it("completes an appointment through the atomic sale RPC", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const rpc = vi.fn(async () => ({
      data: [{ booking_id: IDS.booking, sale_id: IDS.sale, sale_reference: "S-1" }],
      error: null,
    }));
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: bookingRow, error: null })),
      rpc,
    });
    const { status, body } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/appointments/x", { status: "completed" }),
      params,
    ));
    expect(status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("complete_booking_and_create_sale", { p_booking_id: IDS.booking });
    expect(body).toMatchObject({ data: { updated: true, sale: { sale_id: IDS.sale } } });
  });

  it("reschedules through Postgres and emails the client", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    const insert = createQuery({ data: { id: IDS.delivery }, error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: bookingRow, error: null })),
      rpc,
    });
    createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => insert) });
    const { status } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/appointments/x", { startsAt: "2026-09-02T11:00:00+08:00" }),
      params,
    ));
    expect(status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("reschedule_booking", expect.objectContaining({
      p_booking_id: IDS.booking,
      p_starts_at: "2026-09-02T11:00:00+08:00",
    }));
    expect(queueBookingEmail).toHaveBeenCalledWith(IDS.delivery);
  });

  it("maps a reschedule overlap to HTTP 409", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: bookingRow, error: null })),
      rpc: vi.fn(async () => ({ data: null, error: { message: "slot_unavailable" } })),
    });
    const { status, body } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/appointments/x", { startsAt: "2026-09-02T11:00:00+08:00" }),
      params,
    ));
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: { code: "SCHEDULE_CONFLICT" } });
  });
});
