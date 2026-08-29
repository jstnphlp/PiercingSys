import "server-only";
import {
  generateAvailableSlots,
  type AvailableSlot,
  type Service,
  type StudioSettings,
} from "@/lib/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const seededStudio: StudioSettings = {
  id: 1,
  name: "Piercing Corner",
  location: "Parañaque",
  address: null,
  email: null,
  phone: null,
  instagramUrl: "https://www.instagram.com/piercing.corner/",
  timezone: "Asia/Manila",
  currency: "PHP",
  businessHours: {},
  bookingIntervalMinutes: 30,
  minimumLeadHours: 24,
  bookingHorizonDays: 60,
  minimumAge: 18,
  cancellationPolicy: null,
};

function mapSettings(row: Record<string, unknown>): StudioSettings {
  return {
    id: Number(row.id),
    name: String(row.name),
    location: String(row.location),
    address: row.address ? String(row.address) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    instagramUrl: String(row.instagram_url),
    timezone: "Asia/Manila",
    currency: "PHP",
    businessHours: (row.business_hours ??
      {}) as StudioSettings["businessHours"],
    bookingIntervalMinutes: Number(row.booking_interval_minutes),
    minimumLeadHours: Number(row.minimum_lead_hours),
    bookingHorizonDays: Number(row.booking_horizon_days),
    minimumAge: Number(row.minimum_age),
    cancellationPolicy: row.cancellation_policy
      ? String(row.cancellation_policy)
      : null,
  };
}

function mapService(row: Record<string, unknown>): Service {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    bodyArea: row.body_area ? String(row.body_area) : null,
    category: String(row.category) as Service["category"],
    durationMinutes: Number(row.duration_minutes),
    priceCents: row.price_cents === null ? null : Number(row.price_cents),
    minPriceCents:
      row.min_price_cents === null ? null : Number(row.min_price_cents),
    maxPriceCents:
      row.max_price_cents === null ? null : Number(row.max_price_cents),
    priceUnit: row.price_unit ? String(row.price_unit) : null,
    isActive: Boolean(row.is_active),
  };
}

export async function getPublicCatalog() {
  const admin = createSupabaseAdminClient();
  if (!admin)
    return {
      studio: seededStudio,
      services: [] as Service[],
      piercers: [] as Array<{ id: string; name: string }>,
      ready: false,
      reason: "connection" as const,
    };
  const [settingsResult, servicesResult, staffResult, assignmentsResult] =
    await Promise.all([
      admin.from("studio_settings").select("*").eq("id", 1).single(),
      admin
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("staff_profiles")
        .select("user_id,display_name,role")
        .eq("active", true)
        .eq("role", "piercer"),
      admin.from("service_staff").select("staff_id,service_id"),
    ]);
  if (settingsResult.error)
    return {
      studio: seededStudio,
      services: [] as Service[],
      piercers: [],
      ready: false,
      reason: "database" as const,
    };
  const studio = mapSettings(settingsResult.data as Record<string, unknown>);
  const services = (servicesResult.data ?? []).map((row) =>
    mapService(row as Record<string, unknown>),
  );
  const assigned = new Set(
    (assignmentsResult.data ?? [])
      .filter((row) => services.some((service) => service.id === row.service_id))
      .map((row) => row.staff_id),
  );
  const piercers = (staffResult.data ?? [])
    .filter((row) => assigned.has(row.user_id))
    .map((row) => ({ id: row.user_id, name: row.display_name }));
  const ready =
    Object.keys(studio.businessHours).length > 0 &&
    services.length > 0 &&
    piercers.length > 0;
  return {
    studio,
    services,
    piercers,
    ready,
    reason: ready ? null : ("setup" as const),
  };
}

export async function getAvailableSlots(
  serviceId: string,
  date: string,
  piercerId?: string,
): Promise<AvailableSlot[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const dayStart = new Date(`${date}T00:00:00+08:00`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const [
    settingsResult,
    serviceResult,
    assignmentsResult,
    staffResult,
    availabilityResult,
    bookingsResult,
    closuresResult,
  ] = await Promise.all([
    admin.from("studio_settings").select("*").eq("id", 1).single(),
    admin
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .eq("is_active", true)
      .single(),
    admin.from("service_staff").select("staff_id").eq("service_id", serviceId),
    admin
      .from("staff_profiles")
      .select("user_id,active,role")
      .eq("active", true)
      .eq("role", "piercer"),
    admin
      .from("staff_availability")
      .select("staff_id,weekday,starts_at,ends_at"),
    admin
      .from("bookings")
      .select("assigned_piercer_id,starts_at,ends_at,status")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
    admin
      .from("closures")
      .select("starts_at,ends_at")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);
  if (settingsResult.error || serviceResult.error) return [];
  const settings = mapSettings(settingsResult.data as Record<string, unknown>);
  const service = mapService(serviceResult.data as Record<string, unknown>);
  return generateAvailableSlots({
    date,
    serviceDurationMinutes: service.durationMinutes,
    bookingIntervalMinutes: settings.bookingIntervalMinutes,
    minimumLeadHours: settings.minimumLeadHours,
    bookingHorizonDays: settings.bookingHorizonDays,
    businessHours: settings.businessHours,
    staff: (staffResult.data ?? []).map((row) => ({
      id: row.user_id,
      active: row.active,
    })),
    qualifiedStaffIds: (assignmentsResult.data ?? []).map(
      (row) => row.staff_id,
    ),
    availability: (availabilityResult.data ?? []).map((row) => ({
      staffId: row.staff_id,
      weekday: row.weekday,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
    bookings: (bookingsResult.data ?? [])
      .filter((row) => row.assigned_piercer_id)
      .map((row) => ({
        piercerId: row.assigned_piercer_id!,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
      })),
    closures: (closuresResult.data ?? []).map((row) => ({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
    preferredPiercerId: piercerId,
  });
}
