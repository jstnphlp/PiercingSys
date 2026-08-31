import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, sessions } from "@/test/mocks";
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

import { PATCH as patchSettings } from "./route";
import { DELETE as deleteHours, PATCH as patchHours } from "./business-hours/[weekday]/route";

describe("PATCH /api/settings", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("is limited to management and rejects renaming the studio", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await readJson(await patchSettings(jsonRequest("http://localhost/api/settings", { location: "Makati" })))).status).toBe(403);

    getStaffSession.mockResolvedValue(sessions.manager);
    const { status } = await readJson(await patchSettings(jsonRequest("http://localhost/api/settings", { name: "Another Studio" })));
    expect(status).toBe(422);
  });

  it("saves booking window settings", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const update = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => update) });
    const { status } = await readJson(await patchSettings(jsonRequest("http://localhost/api/settings", {
      minimumLeadHours: 48,
      bookingHorizonDays: 30,
      bookingIntervalMinutes: 15,
    })));
    expect(status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      minimum_lead_hours: 48,
      booking_horizon_days: 30,
      booking_interval_minutes: 15,
    }));
  });
});

describe("business hours", () => {
  const tuesday = { params: Promise.resolve({ weekday: "2" }) };

  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("rejects an invalid weekday and inverted hours", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    expect((await readJson(await patchHours(
      jsonRequest("http://localhost/api/settings/business-hours/9", { open: "10:00", close: "18:00" }),
      { params: Promise.resolve({ weekday: "9" }) },
    ))).status).toBe(422);
    expect((await readJson(await patchHours(
      jsonRequest("http://localhost/api/settings/business-hours/2", { open: "18:00", close: "10:00" }),
      tuesday,
    ))).status).toBe(422);
  });

  it("merges a weekday into existing studio hours", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const current = createQuery({ data: { business_hours: { "1": { open: "10:00", close: "18:00" } } }, error: null });
    const update = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn()
        .mockReturnValueOnce(current)
        .mockReturnValue(update),
    });
    const { status, body } = await readJson(await patchHours(
      jsonRequest("http://localhost/api/settings/business-hours/2", { open: "11:00", close: "19:00" }),
      tuesday,
    ));
    expect(status).toBe(200);
    expect(body).toMatchObject({ data: { recurringWeekday: 2 } });
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      business_hours: {
        "1": { open: "10:00", close: "18:00" },
        "2": { open: "11:00", close: "19:00" },
      },
    }));
  });

  it("deletes a weekday from the hours map", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const current = createQuery({ data: { business_hours: { "2": { open: "10:00", close: "18:00" } } }, error: null });
    const update = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn()
        .mockReturnValueOnce(current)
        .mockReturnValue(update),
    });
    await deleteHours(new Request("http://localhost/api/settings/business-hours/2"), tuesday);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      business_hours: {},
    }));
  });
});
