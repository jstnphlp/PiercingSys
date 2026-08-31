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

import { POST as createAvailability } from "./availability/route";
import { DELETE as deleteAvailability, PATCH as patchAvailability } from "./availability/[id]/route";
import { POST as createClosure } from "./closures/route";
import { POST as createStation } from "./stations/route";

describe("schedule administration", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("keeps availability, closures, and stations behind management", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await readJson(await createAvailability(jsonRequest("http://localhost/api/availability", {
      staffId: IDS.piercer, weekday: 2, startsAt: "10:00", endsAt: "18:00",
    })))).status).toBe(403);
    expect((await readJson(await createClosure(jsonRequest("http://localhost/api/closures", {
      startsAt: "2026-09-01T02:00:00.000Z", endsAt: "2026-09-01T06:00:00.000Z",
    })))).status).toBe(403);
    expect((await readJson(await createStation(jsonRequest("http://localhost/api/stations", { name: "Chair 1" })))).status).toBe(403);
  });

  it("rejects inverted availability and closure ranges", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    expect((await readJson(await createAvailability(jsonRequest("http://localhost/api/availability", {
      staffId: IDS.piercer, weekday: 2, startsAt: "18:00", endsAt: "10:00",
    })))).status).toBe(422);
    expect((await readJson(await patchAvailability(
      jsonRequest("http://localhost/api/availability/x", { startsAt: "18:00", endsAt: "10:00" }),
      { params: Promise.resolve({ id: "block" }) },
    ))).status).toBe(422);
    expect((await readJson(await createClosure(jsonRequest("http://localhost/api/closures", {
      startsAt: "2026-09-01T06:00:00.000Z", endsAt: "2026-09-01T02:00:00.000Z",
    })))).status).toBe(422);
  });

  it("creates availability, closures, and stations", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const insert = createQuery({ data: { id: "new-id" }, error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => insert) });
    expect((await readJson(await createAvailability(jsonRequest("http://localhost/api/availability", {
      staffId: IDS.piercer, weekday: 2, startsAt: "10:00", endsAt: "18:00",
    })))).status).toBe(201);
    expect((await readJson(await createClosure(jsonRequest("http://localhost/api/closures", {
      startsAt: "2026-09-01T02:00:00.000Z", endsAt: "2026-09-01T06:00:00.000Z", reason: "Holiday",
    })))).status).toBe(201);
    expect((await readJson(await createStation(jsonRequest("http://localhost/api/stations", { name: "Chair 1" })))).status).toBe(201);
  });

  it("deletes an availability block", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const mutation = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => mutation) });
    const { status, body } = await readJson(await deleteAvailability(
      new Request("http://localhost/api/availability/x"),
      { params: Promise.resolve({ id: "block" }) },
    ));
    expect(status).toBe(200);
    expect(body).toEqual({ data: { deleted: true } });
    expect(mutation.delete).toHaveBeenCalled();
  });
});
