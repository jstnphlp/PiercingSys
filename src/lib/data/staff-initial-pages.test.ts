import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery } from "@/test/mocks";

const createSupabaseAdminClient = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient,
  createSupabaseServerClient,
}));

import {
  calendarAppointmentSelect,
  getCalendarAppointments,
  getClientsPage,
  getSalesPage,
  saleDetailSelect,
} from "./staff";

describe("initial staff page data", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("loads the initial calendar range with the same projection used by the API", async () => {
    const query = createQuery({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });

    await getCalendarAppointments({
      from: "2026-08-29T16:00:00.000Z",
      to: "2026-09-05T15:59:59.999Z",
      piercerId: "10000000-0000-4000-8000-000000000002",
    });

    expect(query.select).toHaveBeenCalledWith(calendarAppointmentSelect);
    expect(query.lt).toHaveBeenCalledWith("starts_at", "2026-09-05T15:59:59.999Z");
    expect(query.gt).toHaveBeenCalledWith("ends_at", "2026-08-29T16:00:00.000Z");
    expect(query.eq).toHaveBeenCalledWith("assigned_piercer_id", "10000000-0000-4000-8000-000000000002");
  });

  it("returns authoritative first-page metadata with clients", async () => {
    const query = createQuery({ data: [], error: null, count: 61 });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => query) });

    const data = await getClientsPage();

    expect(query.select).toHaveBeenCalledWith(
      "id,first_name,last_name,email,phone,created_at,appointment_count,last_appointment_at",
      { count: "exact" },
    );
    expect(query.range).toHaveBeenCalledWith(0, 24);
    expect(data.page).toEqual({ number: 1, size: 25, total: 61, totalPages: 3 });
  });

  it("returns authoritative first-page metadata with sales", async () => {
    const referenceRpc = vi.fn().mockResolvedValue({
      data: {
        studio: null,
        services: [{
          id: "service-1",
          name: "Lobe",
          description: "",
          body_area: "Ear",
          category: "Ear Piercings",
          duration_minutes: 30,
          price_cents: 50_000,
          min_price_cents: null,
          max_price_cents: null,
          price_unit: null,
          is_active: true,
        }],
        staff: [],
        assignments: [],
        stations: [],
        availability: [],
        closures: [],
      },
      error: null,
    });
    createSupabaseAdminClient.mockReturnValue({ rpc: referenceRpc });
    const salesQuery = createQuery({ data: [], error: null, count: 27 });
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => salesQuery) });

    const data = await getSalesPage();

    expect(salesQuery.select).toHaveBeenCalledWith(saleDetailSelect, { count: "exact" });
    expect(salesQuery.range).toHaveBeenCalledWith(0, 24);
    expect(referenceRpc).toHaveBeenCalledWith("staff_reference_data");
    expect(data.services).toEqual([expect.objectContaining({
      id: "service-1",
      durationMinutes: 30,
      priceCents: 50_000,
    })]);
    expect(data.page).toEqual({ number: 1, size: 25, total: 27, totalPages: 2 });
  });

  it("does not request unused sales-list relation fields", () => {
    expect(saleDetailSelect).not.toContain("customer_id");
    expect(saleDetailSelect).not.toContain("sale_adjustments(kind,");
    expect(saleDetailSelect).toContain("sale_adjustments(amount_cents)");
  });
});
