import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));

import { login, signOut } from "./actions";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("login", () => {
  beforeEach(() => {
    createSupabaseServerClient.mockReset();
    redirect.mockClear();
  });

  it("requires both email and password", async () => {
    await expect(login({ error: "" }, form({ email: "", password: "secret" }))).resolves.toEqual({
      error: "Enter your email and password.",
    });
    await expect(login({ error: "" }, form({ email: "owner@example.com", password: "" }))).resolves.toEqual({
      error: "Enter your email and password.",
    });
  });

  it("explains when authentication is not configured", async () => {
    createSupabaseServerClient.mockResolvedValue(null);
    await expect(login({ error: "" }, form({ email: "owner@example.com", password: "secret" }))).resolves.toEqual({
      error: "Staff authentication is not configured yet.",
    });
  });

  it("hides the underlying Auth error for a bad password", async () => {
    createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn(async () => ({ error: { message: "Invalid login credentials" } })) },
    });
    await expect(login({ error: "" }, form({ email: "owner@example.com", password: "nope" }))).resolves.toEqual({
      error: "The email or password is incorrect, or this invitation is not active.",
    });
  });

  it("redirects to the studio desk after a successful sign-in", async () => {
    createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn(async () => ({ error: null })) },
    });
    await expect(login({ error: "" }, form({ email: "owner@example.com", password: "secret" }))).rejects.toThrow("REDIRECT:/app");
  });
});

describe("signOut", () => {
  it("signs out when Supabase is configured and always returns to login", async () => {
    const signOutFn = vi.fn(async () => ({}));
    createSupabaseServerClient.mockResolvedValue({ auth: { signOut: signOutFn } });
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(signOutFn).toHaveBeenCalled();
  });
});
