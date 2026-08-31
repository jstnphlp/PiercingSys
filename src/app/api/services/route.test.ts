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
import { PATCH } from "./[id]/route";

const fixed = {
  name: "Lobe",
  category: "Ear Piercings",
  durationMinutes: 45,
  priceCents: 50000,
};

describe("POST /api/services", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("is limited to management", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await readJson(await POST(jsonRequest("http://localhost/api/services", fixed)))).status).toBe(403);
  });

  it("rejects mixed, incomplete, and inverted prices", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const invalid = [
      { ...fixed, minPriceCents: 10000 },
      { ...fixed, priceCents: undefined, minPriceCents: 10000 },
      { ...fixed, priceCents: undefined, minPriceCents: 50000, maxPriceCents: 20000 },
      { ...fixed, priceCents: undefined },
    ];
    for (const body of invalid) {
      const { status } = await readJson(await POST(jsonRequest("http://localhost/api/services", body)));
      expect(status).toBe(422);
    }
  });

  it("creates a range-priced service and assigns staff", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const services = createQuery({ data: { id: IDS.service }, error: null });
    const assignments = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "services" ? services : assignments),
    });
    const { status, body } = await readJson(await POST(jsonRequest("http://localhost/api/services", {
      name: "Industrial",
      category: "Ear Piercings",
      durationMinutes: 60,
      minPriceCents: 20000,
      maxPriceCents: 45000,
      staffIds: [IDS.piercer],
    })));
    expect(status).toBe(201);
    expect(body).toEqual({ data: { id: IDS.service } });
    expect(services.insert).toHaveBeenCalledWith(expect.objectContaining({
      min_price_cents: 20000,
      max_price_cents: 45000,
      price_cents: null,
    }));
    expect(assignments.insert).toHaveBeenCalledWith([{ service_id: IDS.service, staff_id: IDS.piercer }]);
  });
});

describe("PATCH /api/services/:id", () => {
  it("replaces assignments for an existing service", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const lookup = createQuery({ data: { id: IDS.service }, error: null });
    const mutation = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "services" ? lookup : mutation),
    });
    const { status, body } = await readJson(await PATCH(
      jsonRequest("http://localhost/api/services/x", { staffIds: [IDS.piercer] }),
      { params: Promise.resolve({ id: IDS.service }) },
    ));
    expect(status).toBe(200);
    expect(body).toEqual({ data: { id: IDS.service, staffIds: [IDS.piercer] } });
    expect(mutation.delete).toHaveBeenCalled();
    expect(mutation.insert).toHaveBeenCalledWith([{ service_id: IDS.service, staff_id: IDS.piercer }]);
  });
});
