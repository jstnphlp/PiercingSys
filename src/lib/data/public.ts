import "server-only";
import { unstable_cache } from "next/cache";
import {
  combinedServiceDuration,
  commonQualifiedPiercerIds,
  eachManilaDate,
  generateAvailableSlotsForRange,
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

async function loadPublicCatalog() {
  const admin = createSupabaseAdminClient();
  if (!admin)
    return {
      studio: seededStudio,
      services: [] as Service[],
      piercers: [] as Array<{ id: string; name: string }>,
      assignments: [] as Array<{ serviceId: string; staffId: string }>,
      ready: false,
      reason: "connection" as const,
    };
  const [settingsResult, servicesResult, staffResult, assignmentsResult] =
    await Promise.all([
      admin.from("studio_settings").select("id,name,location,address,email,phone,instagram_url,business_hours,booking_interval_minutes,minimum_lead_hours,booking_horizon_days,minimum_age,cancellation_policy").eq("id", 1).single(),
      admin
        .from("services")
        .select("id,name,description,body_area,category,duration_minutes,price_cents,min_price_cents,max_price_cents,price_unit,is_active")
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
      assignments: [] as Array<{ serviceId: string; staffId: string }>,
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
    assignments: (assignmentsResult.data ?? []).map((row) => ({
      serviceId: row.service_id,
      staffId: row.staff_id,
    })),
    ready,
    reason: ready ? null : ("setup" as const),
  };
}

export const getPublicCatalog = unstable_cache(
  loadPublicCatalog,
  ["piercing-corner-public-catalog-v1"],
  { revalidate: 60, tags: ["public-catalog"] },
);

export async function getAvailableSlots(input: {
  serviceIds: string[];
  from: string;
  to?: string;
  piercerId?: string;
}): Promise<AvailableSlot[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const from = input.from;
  const to = input.to ?? input.from;
  const rpc = await admin.rpc("available_slots", {
    p_service_ids: input.serviceIds,
    p_from: from,
    p_to: to,
    p_piercer_id: input.piercerId ?? null,
    p_enforce_booking_window: true,
  });
  if (!rpc.error && rpc.data) {
    return (rpc.data as Array<{ starts_at: string; ends_at: string; piercer_ids: string[] }>).map((row) => ({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      piercerIds: row.piercer_ids ?? [],
    }));
  }
  return loadAvailableSlotsInProcess(input.serviceIds, from, to, input.piercerId);
}

async function loadAvailableSlotsInProcess(
  serviceIds: string[],
  from: string,
  to: string,
  piercerId?: string,
): Promise<AvailableSlot[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const rangeStart = new Date(`${from}T00:00:00+08:00`);
  const rangeEnd = new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86_400_000);
  const weekdays = [...new Set(eachManilaDate(from, to).map((date) => new Date(`${date}T12:00:00Z`).getUTCDay()))];
  const [
    settingsResult,
    servicesResult,
    assignmentsResult,
    staffResult,
    availabilityResult,
    bookingsResult,
    closuresResult,
  ] = await Promise.all([
    admin.from("studio_settings").select("id,name,location,address,email,phone,instagram_url,business_hours,booking_interval_minutes,minimum_lead_hours,booking_horizon_days,minimum_age,cancellation_policy").eq("id", 1).single(),
    admin.from("services").select("id,name,description,body_area,category,duration_minutes,price_cents,min_price_cents,max_price_cents,price_unit,is_active").in("id", serviceIds).eq("is_active", true),
    admin.from("service_staff").select("staff_id,service_id").in("service_id", serviceIds),
    admin.from("staff_profiles").select("user_id,active,role").eq("active", true).eq("role", "piercer"),
    admin.from("staff_availability").select("staff_id,weekday,starts_at,ends_at").in("weekday", weekdays),
    admin.from("bookings").select("assigned_piercer_id,starts_at,ends_at,status")
      .lt("starts_at", rangeEnd.toISOString()).gt("ends_at", rangeStart.toISOString())
      .not("status", "in", "(cancelled,rejected)"),
    admin.from("closures").select("starts_at,ends_at")
      .lt("starts_at", rangeEnd.toISOString()).gt("ends_at", rangeStart.toISOString()),
  ]);
  if (settingsResult.error || servicesResult.error ||
      (servicesResult.data ?? []).length !== serviceIds.length) return [];
  const settings = mapSettings(settingsResult.data as Record<string, unknown>);
  const services = (servicesResult.data ?? []).map((row) => mapService(row as Record<string, unknown>));
  const assignments = (assignmentsResult.data ?? []).map((row) => ({
    staffId: row.staff_id,
    serviceId: row.service_id,
  }));
  return generateAvailableSlotsForRange({
    from,
    to,
    serviceDurationMinutes: combinedServiceDuration(services),
    bookingIntervalMinutes: settings.bookingIntervalMinutes,
    minimumLeadHours: settings.minimumLeadHours,
    bookingHorizonDays: settings.bookingHorizonDays,
    businessHours: settings.businessHours,
    staff: (staffResult.data ?? []).map((row) => ({ id: row.user_id, active: row.active })),
    qualifiedStaffIds: commonQualifiedPiercerIds(serviceIds, assignments),
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
