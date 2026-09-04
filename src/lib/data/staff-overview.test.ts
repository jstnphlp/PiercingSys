import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery } from "@/test/mocks";

const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient,
}));

import {
  getOverviewBookings,
  getOverviewCustomerCount,
  getOverviewRevenue,
} from "./staff";

describe("overview data loading", () => {
  beforeEach(() => {
    createSupabaseServerClient.mockReset();
  });

  it("uses a summary booking projection without unused pricing fields", async () => {
    const query = createQuery({ data: [], error: null });
    const from = vi.fn(() => query);
    createSupabaseServerClient.mockResolvedValue({ from });

    await getOverviewBookings();

    expect(from).toHaveBeenCalledWith("bookings");
    const select = vi.mocked(query.select).mock.calls[0]?.[0];
    expect(select).toContain("booking_services(service_id,position,name)");
    expect(select).not.toContain("price_cents");
    expect(select).not.toContain("duration_minutes");
  });

  it("loads only completed sale totals and adjustments for revenue", async () => {
    const query = createQuery({
      data: [{ total_cents: 100_000, sale_adjustments: [{ amount_cents: 25_000 }] }],
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });

    const data = await getOverviewRevenue();

    expect(query.select).toHaveBeenCalledWith("total_cents,sale_adjustments(amount_cents)");
    expect(query.eq).toHaveBeenCalledWith("status", "completed");
    expect(data).toMatchObject({ completedRevenueCents: 75_000, completedSaleCount: 1 });
  });

  it("keeps the RLS-aware customer count exact without returning rows", async () => {
    const query = createQuery({ data: null, error: null, count: 42 });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });

    const data = await getOverviewCustomerCount();

    expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(data.customerCount).toBe(42);
  });
});
