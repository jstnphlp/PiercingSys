import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS } from "@/test/mocks";
import { readJson } from "@/test/http";

const createSupabaseAdminClient = vi.hoisted(() => vi.fn());
const queueBookingSideEffects = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient,
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/booking-side-effects", () => ({
  queueBookingSideEffects,
  queueBookingEmail: vi.fn(),
}));

import { POST } from "./route";

function bookingForm(overrides: Record<string, string | File> = {}) {
  const form = new FormData();
  form.set("serviceId", IDS.service);
  form.set("startsAt", "2026-09-01T10:00:00+08:00");
  form.set("firstName", "Ana");
  form.set("lastName", "Cruz");
  form.set("email", "ana@example.com");
  form.set("phone", "09170000000");
  form.set("ageConfirmed", "on");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return new Request("http://localhost/api/public/bookings", { method: "POST", body: form });
}

describe("POST /api/public/bookings", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
    queueBookingSideEffects.mockReset();
  });

  it("returns 503 when online booking is not configured", async () => {
    createSupabaseAdminClient.mockReturnValue(null);
    const { status, body } = await readJson(await POST(bookingForm()));
    expect(status).toBe(503);
    expect(body).toMatchObject({ error: { code: "NOT_CONFIGURED" } });
  });

  it("rejects an invalid photo before creating a booking", async () => {
    createSupabaseAdminClient.mockReturnValue({ rpc: vi.fn() });
    const photo = new File([new Uint8Array([1, 2, 3])], "ref.gif", { type: "image/gif" });
    const { status, body } = await readJson(await POST(bookingForm({ photo })));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "INVALID_PHOTO" } });
  });

  it("rejects a booking without age confirmation", async () => {
    createSupabaseAdminClient.mockReturnValue({ rpc: vi.fn() });
    const form = new FormData();
    form.set("serviceId", IDS.service);
    form.set("startsAt", "2026-09-01T10:00:00+08:00");
    form.set("firstName", "Ana");
    form.set("lastName", "Cruz");
    form.set("email", "ana@example.com");
    form.set("phone", "09170000000");
    const { status, body } = await readJson(await POST(new Request("http://localhost/api/public/bookings", {
      method: "POST",
      body: form,
    })));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("creates a confirmed booking and queues email plus photo side effects", async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        id: IDS.booking,
        reference: "PC-1001",
        status: "confirmed",
        starts_at: "2026-09-01T02:00:00.000Z",
        ends_at: "2026-09-01T02:45:00.000Z",
        was_created: true,
      }],
      error: null,
    }));
    const deliveries = createQuery({ data: { id: IDS.delivery }, error: null });
    createSupabaseAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(() => deliveries),
    });
    const photo = new File([new Uint8Array([7, 7, 7])], "ref.jpg", { type: "image/jpeg" });
    const { status, body } = await readJson(await POST(bookingForm({
      photo,
      preferredPiercerId: IDS.piercer,
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    })));
    expect(status).toBe(201);
    expect(body).toEqual({
      data: {
        id: IDS.booking,
        reference: "PC-1001",
        status: "confirmed",
        startsAt: "2026-09-01T02:00:00.000Z",
        endsAt: "2026-09-01T02:45:00.000Z",
      },
    });
    expect(rpc).toHaveBeenCalledWith("create_public_booking_with_result", expect.objectContaining({
      p_service_ids: [IDS.service],
      p_preferred_piercer_id: IDS.piercer,
      p_idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }));
    expect(queueBookingSideEffects).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: IDS.booking,
      deliveryId: IDS.delivery,
      photo: expect.objectContaining({ type: "image/jpeg", size: 3 }),
    }));
  });

  it("queues one photo and confirmation side effect across idempotent retries", async () => {
    const booking = {
      id: IDS.booking,
      reference: "PC-1001",
      status: "confirmed",
      starts_at: "2026-09-01T02:00:00.000Z",
      ends_at: "2026-09-01T02:45:00.000Z",
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ ...booking, was_created: true }], error: null })
      .mockResolvedValueOnce({ data: [{ ...booking, was_created: false }], error: null });
    const deliveries = createQuery({ data: { id: IDS.delivery }, error: null });
    const from = vi.fn(() => deliveries);
    createSupabaseAdminClient.mockReturnValue({ rpc, from });
    const photo = new File([new Uint8Array([7, 7, 7])], "ref.jpg", { type: "image/jpeg" });
    const values = {
      photo,
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };

    const first = await readJson(await POST(bookingForm(values)));
    const retry = await readJson(await POST(bookingForm(values)));

    expect(first.body).toEqual(retry.body);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledTimes(1);
    expect(queueBookingSideEffects).toHaveBeenCalledOnce();
    expect(queueBookingSideEffects).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: IDS.booking,
      deliveryId: IDS.delivery,
      photo: expect.objectContaining({ type: "image/jpeg", size: 3 }),
    }));
  });

  it("maps a lost slot to HTTP 409", async () => {
    createSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn(async () => ({ data: null, error: { code: "23P01", message: "slot_unavailable" } })),
    });
    const { status, body } = await readJson(await POST(bookingForm()));
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: { code: "SLOT_UNAVAILABLE" } });
  });

  it("maps an unconfigured studio to HTTP 503", async () => {
    createSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn(async () => ({ data: null, error: { message: "booking_not_configured" } })),
    });
    const { status, body } = await readJson(await POST(bookingForm()));
    expect(status).toBe(503);
    expect(body).toMatchObject({ error: { code: "NOT_CONFIGURED" } });
  });
});
