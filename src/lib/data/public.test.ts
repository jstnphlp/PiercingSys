import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, fromTables, IDS } from "@/test/mocks";

const createSupabaseAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient,
  createSupabaseServerClient: vi.fn(),
}));

import { manilaDate, manilaWeekday } from "@/lib/domain";
import { getAvailableSlots, getPublicCatalog, seededStudio } from "./public";

function upcomingWeekday(weekday: number) {
  const start = new Date(Date.now() + 3 * 86_400_000);
  for (let offset = 0; offset < 14; offset += 1) {
    const date = manilaDate(new Date(start.getTime() + offset * 86_400_000));
    if (manilaWeekday(date) === weekday) return date;
  }
  throw new Error("Could not find an upcoming weekday for the test.");
}

const settingsRow = {
  id: 1,
  name: "Piercing Corner",
  location: "Parañaque",
  address: "Sucat",
  email: "studio@example.com",
  phone: "02-8000",
  instagram_url: "https://www.instagram.com/piercing.corner/",
  business_hours: { "2": { open: "10:00", close: "18:00" } },
  booking_interval_minutes: 30,
  minimum_lead_hours: 24,
  booking_horizon_days: 60,
  minimum_age: 18,
  cancellation_policy: "24 hours",
};

const serviceRow = {
  id: IDS.service,
  name: "Lobe",
  description: null,
  body_area: "Ear",
  category: "Ear Piercings",
  duration_minutes: 45,
  price_cents: 50000,
  min_price_cents: null,
  max_price_cents: null,
  price_unit: null,
  is_active: true,
};

describe("public catalog", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
  });

  it("returns the seeded preview catalog when Supabase is not configured", async () => {
    createSupabaseAdminClient.mockReturnValue(null);
    await expect(getPublicCatalog()).resolves.toMatchObject({
      studio: seededStudio,
      services: [],
      piercers: [],
      ready: false,
      reason: "connection",
    });
  });

  it("marks the studio as not ready when settings cannot be loaded", async () => {
    createSupabaseAdminClient.mockReturnValue({
      from: fromTables({
        studio_settings: { data: null, error: { message: "missing" } },
        services: { data: [], error: null },
        staff_profiles: { data: [], error: null },
        service_staff: { data: [], error: null },
      }),
    });
    await expect(getPublicCatalog()).resolves.toMatchObject({
      ready: false,
      reason: "database",
    });
  });

  it("is ready only with hours, active services, and assigned piercers", async () => {
    createSupabaseAdminClient.mockReturnValue({
      from: fromTables({
        studio_settings: { data: settingsRow, error: null },
        services: { data: [serviceRow], error: null },
        staff_profiles: {
          data: [
            { user_id: IDS.piercer, display_name: "Piercer One", role: "piercer" },
            { user_id: IDS.owner, display_name: "Owner", role: "owner" },
          ],
          error: null,
        },
        service_staff: { data: [{ staff_id: IDS.piercer, service_id: IDS.service }], error: null },
      }),
    });
    const catalog = await getPublicCatalog();
    expect(catalog.ready).toBe(true);
    expect(catalog.reason).toBeNull();
    expect(catalog.piercers).toEqual([{ id: IDS.piercer, name: "Piercer One" }]);
    expect(catalog.studio.address).toBe("Sucat");
    expect(catalog.services[0]).toMatchObject({ id: IDS.service, name: "Lobe", priceCents: 50000 });
  });

  it("stays in setup mode when no piercer is assigned to a live service", async () => {
    createSupabaseAdminClient.mockReturnValue({
      from: fromTables({
        studio_settings: { data: settingsRow, error: null },
        services: { data: [serviceRow], error: null },
        staff_profiles: {
          data: [{ user_id: IDS.piercer, display_name: "Piercer One", role: "piercer" }],
          error: null,
        },
        service_staff: { data: [], error: null },
      }),
    });
    await expect(getPublicCatalog()).resolves.toMatchObject({ ready: false, reason: "setup" });
  });
});

describe("getAvailableSlots", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
  });

  it("returns no openings without a configured admin client", async () => {
    createSupabaseAdminClient.mockReturnValue(null);
    await expect(getAvailableSlots({ serviceIds: [IDS.service], from: "2026-09-01" })).resolves.toEqual([]);
  });

  it("maps the Postgres availability RPC into public slot objects", async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        starts_at: "2026-09-01T02:00:00.000Z",
        ends_at: "2026-09-01T02:45:00.000Z",
        piercer_ids: [IDS.piercer],
      }],
      error: null,
    }));
    createSupabaseAdminClient.mockReturnValue({ rpc, from: vi.fn() });
    await expect(getAvailableSlots({
      serviceIds: [IDS.service],
      from: "2026-09-01",
      to: "2026-09-07",
      piercerId: IDS.piercer,
    })).resolves.toEqual([{
      startsAt: "2026-09-01T02:00:00.000Z",
      endsAt: "2026-09-01T02:45:00.000Z",
      piercerIds: [IDS.piercer],
    }]);
    expect(rpc).toHaveBeenCalledWith("available_slots", {
      p_service_ids: [IDS.service],
      p_from: "2026-09-01",
      p_to: "2026-09-07",
      p_piercer_id: IDS.piercer,
      p_enforce_booking_window: true,
    });
  });

  it("falls back in-process when the RPC is unavailable and a service is missing", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "function not found" } }));
    createSupabaseAdminClient.mockReturnValue({
      rpc,
      from: fromTables({
        studio_settings: { data: settingsRow, error: null },
        services: { data: [serviceRow], error: null },
        service_staff: { data: [], error: null },
        staff_profiles: { data: [], error: null },
        staff_availability: { data: [], error: null },
        bookings: { data: [], error: null },
        closures: { data: [], error: null },
      }),
    });
    await expect(getAvailableSlots({
      serviceIds: [IDS.service, IDS.service2],
      from: "2026-09-01",
    })).resolves.toEqual([]);
  });

  it("computes fallback slots from studio hours, duration, and qualified staff", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "rpc down" } }));
    createSupabaseAdminClient.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        const rows: Record<string, unknown> = {
          studio_settings: settingsRow,
          services: [serviceRow],
          service_staff: [{ staff_id: IDS.piercer, service_id: IDS.service }],
          staff_profiles: [{ user_id: IDS.piercer, active: true, role: "piercer" }],
          staff_availability: [{ staff_id: IDS.piercer, weekday: 2, starts_at: "10:00", ends_at: "11:00" }],
          bookings: [],
          closures: [],
        };
        return createQuery({ data: table === "studio_settings" ? rows[table] : rows[table] ?? [], error: null });
      }),
    });
    const from = upcomingWeekday(2);
    const slots = await getAvailableSlots({ serviceIds: [IDS.service], from });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.piercerIds).toEqual([IDS.piercer]);
    expect(new Date(slots[0]!.endsAt).getTime() - new Date(slots[0]!.startsAt).getTime()).toBe(45 * 60_000);
  });
});
