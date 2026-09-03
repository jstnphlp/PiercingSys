import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, sessions } from "@/test/mocks";
import { readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

import { GET as getCustomers } from "./customers/route";
import { GET as getSales } from "./sales/route";

describe("bounded workspace lists", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("requires authentication and keeps sales management-only", async () => {
    getStaffSession.mockResolvedValue(null);
    expect((await getCustomers(new Request("http://localhost/api/customers"))).status).toBe(401);
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await getSales(new Request("http://localhost/api/sales"))).status).toBe(403);
  });

  it("returns page metadata and applies the requested bounded range", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const customers = createQuery({ data: [], error: null, count: 76 });
    const sales = createQuery({ data: [], error: null, count: 51 });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "customer_directory" ? customers : sales),
    });

    const customerResponse = await readJson(await getCustomers(new Request("http://localhost/api/customers?page=2&pageSize=25")));
    const saleResponse = await readJson(await getSales(new Request("http://localhost/api/sales?page=2&pageSize=25")));

    expect(customers.range).toHaveBeenCalledWith(25, 49);
    expect(sales.range).toHaveBeenCalledWith(25, 49);
    expect(customerResponse.body).toMatchObject({ page: { number: 2, size: 25, total: 76, totalPages: 4 } });
    expect(saleResponse.body).toMatchObject({ page: { number: 2, size: 25, total: 51, totalPages: 3 } });
  });

  it("searches normalized multi-word names through the directory full-name field", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const customers = createQuery({ data: [], error: null, count: 0 });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => customers) });

    await getCustomers(new Request("http://localhost/api/customers?q=%20Juan%20%20Dela%20%20Cruz%20"));

    expect(customers.or).toHaveBeenCalledWith("full_name.ilike.*Juan*Dela*Cruz*,email.ilike.*Juan Dela Cruz*,phone.ilike.*Juan Dela Cruz*");
  });
});
