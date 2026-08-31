import { describe, expect, it } from "vitest";
import { mapBookingRow } from "./staff";
import { IDS } from "@/test/mocks";

const serviceA = {
  service_id: IDS.service,
  position: 2,
  name: "Nostril",
  price_cents: null,
  min_price_cents: 20000,
  max_price_cents: 35000,
  price_unit: "per piercing",
  duration_minutes: 30,
};
const serviceB = {
  service_id: IDS.service2,
  position: 1,
  name: "Lobe",
  price_cents: 50000,
  min_price_cents: null,
  max_price_cents: null,
  price_unit: null,
  duration_minutes: 45,
};

describe("mapBookingRow", () => {
  it("normalizes nested Supabase objects and sorts services by position", () => {
    const booking = mapBookingRow({
      id: IDS.booking,
      reference: "PC-1001",
      status: "confirmed",
      starts_at: "2026-09-01T02:00:00.000Z",
      ends_at: "2026-09-01T03:15:00.000Z",
      notes: "Gold hoop",
      customers: {
        id: IDS.customer,
        first_name: "Ana",
        last_name: "Cruz",
        email: "ana@example.com",
        phone: "09170000000",
      },
      booking_services: [serviceA, serviceB],
      staff_profiles: { user_id: IDS.piercer, display_name: "Piercer One", color: "#78b8aa" },
      stations: { name: "Chair 1" },
      sales: { status: "draft" },
    });

    expect(booking.customer).toEqual({
      id: IDS.customer,
      name: "Ana Cruz",
      email: "ana@example.com",
      phone: "09170000000",
    });
    expect(booking.services.map((service) => service.name)).toEqual(["Lobe", "Nostril"]);
    expect(booking.services[0]).toMatchObject({
      priceCents: 50000,
      minPriceCents: null,
      durationMinutes: 45,
    });
    expect(booking.piercer).toEqual({ id: IDS.piercer, name: "Piercer One", color: "#78b8aa" });
    expect(booking.station).toBe("Chair 1");
    expect(booking.saleState).toBe("draft");
    expect(booking.notes).toBe("Gold hoop");
  });

  it("unwraps one-element relation arrays returned by PostgREST", () => {
    const booking = mapBookingRow({
      id: IDS.booking,
      reference: "PC-1001",
      status: "confirmed",
      starts_at: "2026-09-01T02:00:00.000Z",
      ends_at: "2026-09-01T03:15:00.000Z",
      notes: null,
      customers: [{ id: IDS.customer, first_name: "Ana", last_name: "Cruz", email: "ana@example.com", phone: "0917" }],
      booking_services: [serviceB],
      staff_profiles: [{ user_id: IDS.piercer, display_name: "Piercer One", color: "#78b8aa" }],
      stations: [{ name: "Chair 1" }],
      sales: [{ status: "completed" }],
    });
    expect(booking.customer.name).toBe("Ana Cruz");
    expect(booking.piercer?.id).toBe(IDS.piercer);
    expect(booking.station).toBe("Chair 1");
    expect(booking.saleState).toBe("completed");
    expect(booking.notes).toBeNull();
  });

  it("keeps unassigned piercers, stations, and sales empty without inventing a client name", () => {
    const booking = mapBookingRow({
      id: IDS.booking,
      reference: "PC-1001",
      status: "requested",
      starts_at: "2026-09-01T02:00:00.000Z",
      ends_at: "2026-09-01T03:15:00.000Z",
      notes: null,
      customers: null,
      booking_services: [],
      staff_profiles: null,
      stations: null,
      sales: null,
    });
    expect(booking.customer).toEqual({ id: "", name: "", email: "", phone: "" });
    expect(booking.piercer).toBeNull();
    expect(booking.station).toBeNull();
    expect(booking.saleState).toBeNull();
    expect(booking.services).toEqual([]);
  });
});
