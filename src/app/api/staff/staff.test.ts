import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS, sessions } from "@/test/mocks";
import { jsonRequest, readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseAdminClient = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient,
  createSupabaseServerClient,
}));

import { POST as invite } from "./invitations/route";
import { PATCH as patchStaff } from "./[id]/route";

describe("POST /api/staff/invitations", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseAdminClient.mockReset();
  });

  it("is owner-only", async () => {
    getStaffSession.mockResolvedValue(null);
    expect((await readJson(await invite(jsonRequest("http://localhost/api/staff/invitations", {
      email: "new@example.com", displayName: "New", role: "piercer",
    })))).status).toBe(401);
    getStaffSession.mockResolvedValue(sessions.manager);
    expect((await readJson(await invite(jsonRequest("http://localhost/api/staff/invitations", {
      email: "new@example.com", displayName: "New", role: "piercer",
    })))).status).toBe(403);
  });

  it("cannot invite another owner through this endpoint", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const { status } = await readJson(await invite(jsonRequest("http://localhost/api/staff/invitations", {
      email: "new@example.com", displayName: "New", role: "owner",
    })));
    expect(status).toBe(422);
  });

  it("creates a profile for a newly invited user", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const profile = createQuery({ data: { ok: true }, error: null });
    const audit = createQuery({ data: { ok: true }, error: null });
    createSupabaseAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: IDS.piercer } }, error: null })) } },
      from: vi.fn((table: string) => table === "staff_profiles" ? profile : audit),
    });
    const { status, body } = await readJson(await invite(jsonRequest("http://localhost/api/staff/invitations", {
      email: "piercer@example.com", displayName: "Piercer One", role: "piercer",
    })));
    expect(status).toBe(201);
    expect(body).toEqual({ data: { userId: IDS.piercer, invited: true } });
    expect(profile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: IDS.piercer,
      role: "piercer",
      active: true,
    }));
  });

  it("reuses an Auth user that is already registered", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const profile = createQuery({ data: { ok: true }, error: null });
    createSupabaseAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail: vi.fn(async () => ({
        data: null,
        error: { message: "A user with this email address has already been registered" },
      })) } },
      rpc: vi.fn(async () => ({ data: IDS.manager, error: null })),
      from: vi.fn(() => profile),
    });
    const { status, body } = await readJson(await invite(jsonRequest("http://localhost/api/staff/invitations", {
      email: "manager@example.com", displayName: "Manager", role: "manager",
    })));
    expect(status).toBe(201);
    expect(body).toEqual({ data: { userId: IDS.manager, invited: false } });
  });

  it("surfaces a Supabase invitation rate limit", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    createSupabaseAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail: vi.fn(async () => ({
        data: { user: null },
        error: { message: "email rate limit exceeded" },
      })) } },
    });
    const { status, body } = await readJson(await invite(jsonRequest("http://localhost/api/staff/invitations", {
      email: "new@example.com", displayName: "New", role: "piercer",
    })));
    expect(status).toBe(429);
    expect(body).toMatchObject({ error: { code: "INVITE_RATE_LIMITED" } });
  });
});

describe("PATCH /api/staff/:id", () => {
  const params = { params: Promise.resolve({ id: IDS.manager }) };

  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("is owner-only", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const { status } = await readJson(await patchStaff(
      jsonRequest("http://localhost/api/staff/x", { active: false }),
      params,
    ));
    expect(status).toBe(403);
  });

  it("transfers ownership through the dedicated RPC", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    createSupabaseServerClient.mockResolvedValue({ rpc });
    const { status } = await readJson(await patchStaff(
      jsonRequest("http://localhost/api/staff/x", { role: "owner" }),
      params,
    ));
    expect(status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("transfer_ownership", { new_owner_id: IDS.manager });
  });

  it("updates role and access without transferring ownership", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const update = createQuery({ data: { ok: true }, error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => update) });
    const { status } = await readJson(await patchStaff(
      jsonRequest("http://localhost/api/staff/x", { role: "piercer", active: false, displayName: "Ada" }),
      params,
    ));
    expect(status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      role: "piercer",
      active: false,
      display_name: "Ada",
    }));
  });
});
