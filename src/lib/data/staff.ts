import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { StaffSession } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BookingStatus,
  PaymentMethod,
  SaleStatus,
  Service,
} from "@/lib/domain";
import { manilaDayBounds } from "@/lib/domain";
import { seededStudio } from "@/lib/data/public";
import { customerDisplayContact, customerDisplayName } from "@/lib/walk-in-customer";

export type BookingRecord = {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  customer: { id: string; name: string; email: string; phone: string };
  services: Array<{
    id: string;
    name: string;
    priceCents: number | null;
    minPriceCents: number | null;
    maxPriceCents: number | null;
    priceUnit: string | null;
    durationMinutes: number;
  }>;
  piercer: { id: string; name: string; color: string } | null;
  station: string | null;
  saleState: string | null;
};
export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  appointmentCount?: number;
  lastActivityAt?: string | null;
};
export type SaleRecord = {
  id: string;
  reference: string;
  status: SaleStatus;
  totalCents: number;
  createdAt: string;
  customerName: string;
  methods: PaymentMethod[];
  paidCents: number;
  adjustmentCents: number;
  bookingId: string | null;
  items: Array<{
    id: string;
    description: string;
    unitPriceCents: number | null;
    minPriceCents: number | null;
    maxPriceCents: number | null;
  }>;
};
export type StaffRecord = {
  id: string;
  displayName: string;
  role: string;
  active: boolean;
  color: string;
};
export type DeliveryRecord = {
  id: string;
  kind: string;
  recipient: string;
  status: string;
  lastError: string | null;
  createdAt: string;
};
export type ClosureRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};
export type AvailabilityRecord = {
  id: string;
  staffId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  availabilityDate: string | null;
};

export const saleDetailSelect =
  "id,reference,status,total_cents,created_at,booking_id,customer_id,customers(first_name,last_name),payments(method,amount_cents),sale_adjustments(kind,amount_cents),sale_items(id,description,unit_price_cents,min_price_cents,max_price_cents)";

export const bookingDetailSelect =
  "id,reference,status,starts_at,ends_at,notes,customers(id,first_name,last_name,email,phone),booking_services(id,service_id,position,name,price_cents,min_price_cents,max_price_cents,price_unit,duration_minutes),staff_profiles!bookings_assigned_piercer_id_fkey(user_id,display_name,color),stations(name),sales(id,status)";

type Relation = Record<string, unknown> | Array<Record<string, unknown>> | null;
function one(value: Relation) {
  return Array.isArray(value) ? value[0] : value;
}

export function mapSaleRow(row: Record<string, unknown>): SaleRecord {
  const customer = one(row.customers as Relation);
  const payments = (row.payments ?? []) as Array<{ method: PaymentMethod; amount_cents: number }>;
  const adjustments = (row.sale_adjustments ?? []) as Array<{ amount_cents: number }>;
  return {
    id: String(row.id),
    reference: String(row.reference),
    status: row.status as SaleStatus,
    totalCents: Number(row.total_cents),
    createdAt: String(row.created_at),
    customerName: customer ? customerDisplayName(customer.first_name, customer.last_name) : "Walk-in",
    methods: payments.map((item) => item.method),
    paidCents: payments.reduce((sum, item) => sum + item.amount_cents, 0),
    adjustmentCents: adjustments.reduce((sum, item) => sum + item.amount_cents, 0),
    bookingId: row.booking_id == null ? null : String(row.booking_id),
    items: ((row.sale_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      description: String(item.description),
      unitPriceCents: item.unit_price_cents == null ? null : Number(item.unit_price_cents),
      minPriceCents: item.min_price_cents == null ? null : Number(item.min_price_cents),
      maxPriceCents: item.max_price_cents == null ? null : Number(item.max_price_cents),
    })),
  };
}

export function mapBookingRow(row: Record<string, unknown>): BookingRecord {
  const customer = one(row.customers as Relation);
  const services = ((row.booking_services ?? []) as Array<Record<string, unknown>>)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const piercer = one(row.staff_profiles as Relation);
  const station = one(row.stations as Relation);
  const sale = one(row.sales as Relation);
  return {
    id: String(row.id),
    reference: String(row.reference),
    status: row.status as BookingStatus,
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    notes: row.notes == null ? null : String(row.notes),
    customer: {
      id: String(customer?.id ?? ""),
      name: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim(),
      email: String(customer?.email ?? ""),
      phone: String(customer?.phone ?? ""),
    },
    services: services.map((service) => ({
      id: String(service.service_id ?? ""),
      name: String(service.name ?? "Service"),
      priceCents: service.price_cents == null ? null : Number(service.price_cents),
      minPriceCents: service.min_price_cents == null ? null : Number(service.min_price_cents),
      maxPriceCents: service.max_price_cents == null ? null : Number(service.max_price_cents),
      priceUnit: service.price_unit ? String(service.price_unit) : null,
      durationMinutes: Number(service.duration_minutes ?? 0),
    })),
    piercer: piercer
      ? {
          id: String(piercer.user_id),
          name: String(piercer.display_name),
          color: String(piercer.color),
        }
      : null,
    station: station ? String(station.name) : null,
    saleState: sale ? String(sale.status) : null,
  };
}

export type StaffDataScope =
  | "overview"
  | "calendar"
  | "clients"
  | "sales"
  | "reports"
  | "settings"
  | "all";

const emptyData = {
  studio: seededStudio,
  services: [] as Service[],
  bookings: [] as BookingRecord[],
  customers: [] as CustomerRecord[],
  sales: [] as SaleRecord[],
  staff: [] as StaffRecord[],
  serviceAssignments: [] as Array<{ serviceId: string; staffId: string }>,
  deliveries: [] as DeliveryRecord[],
  stations: [] as Array<{ id: string; name: string }>,
  closures: [] as ClosureRecord[],
  availability: [] as AvailabilityRecord[],
  customerCount: 0,
  bookingStatusCounts: {} as Record<string, number>,
  paymentMethodTotals: {} as Record<string, number>,
  completedRevenueCents: 0,
  completedSaleCount: 0,
  reportSaleCount: 0,
  reportBookingCount: 0,
  error: null as string | null,
};

const emptyReferenceData = {
  studio: seededStudio,
  services: [] as Service[],
  staff: [] as StaffRecord[],
  serviceAssignments: [] as Array<{ serviceId: string; staffId: string }>,
  stations: [] as Array<{ id: string; name: string }>,
  closures: [] as ClosureRecord[],
  availability: [] as AvailabilityRecord[],
  error: null as string | null,
};

async function getCachedStaffReferenceData(scope: StaffDataScope) {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { ...emptyReferenceData, error: "Supabase is not configured." };
  const includes = (...scopes: StaffDataScope[]) => scope === "all" || scopes.includes(scope);
  const [settingsResult, servicesResult, staffResult, assignmentResult, stationResult, availabilityResult, closureResult] = await Promise.all([
    includes("overview", "settings")
      ? admin.from("studio_settings").select("id,name,location,address,email,phone,instagram_url,business_hours,booking_interval_minutes,minimum_lead_hours,booking_horizon_days,minimum_age,cancellation_policy").eq("id", 1).single()
      : Promise.resolve({ data: null, error: null }),
    includes("overview", "calendar", "sales", "settings")
      ? admin.from("services").select("id,name,description,body_area,category,duration_minutes,price_cents,min_price_cents,max_price_cents,price_unit,is_active,sort_order").order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    includes("overview", "calendar", "settings")
      ? admin.from("staff_profiles").select("user_id,display_name,role,active,color").order("created_at")
      : Promise.resolve({ data: [], error: null }),
    includes("overview", "calendar", "settings")
      ? admin.from("service_staff").select("service_id,staff_id")
      : Promise.resolve({ data: [], error: null }),
    includes("calendar", "settings")
      ? admin.from("stations").select("id,name").eq("active", true).order("name")
      : Promise.resolve({ data: [], error: null }),
    includes("settings")
      ? admin.from("staff_availability").select("id,staff_id,weekday,starts_at,ends_at,availability_date").order("weekday").order("starts_at")
      : Promise.resolve({ data: [], error: null }),
    includes("settings")
      ? admin.from("closures").select("id,starts_at,ends_at,reason").order("starts_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const settingsRow = settingsResult.data;
  const errors = [settingsResult.error, servicesResult.error, staffResult.error, assignmentResult.error, stationResult.error, availabilityResult.error, closureResult.error].filter(Boolean);
  return {
    studio: settingsRow ? {
      id: settingsRow.id,
      name: settingsRow.name,
      location: settingsRow.location,
      address: settingsRow.address,
      email: settingsRow.email,
      phone: settingsRow.phone,
      instagramUrl: settingsRow.instagram_url,
      timezone: "Asia/Manila" as const,
      currency: "PHP" as const,
      businessHours: settingsRow.business_hours,
      bookingIntervalMinutes: settingsRow.booking_interval_minutes,
      minimumLeadHours: settingsRow.minimum_lead_hours,
      bookingHorizonDays: settingsRow.booking_horizon_days,
      minimumAge: settingsRow.minimum_age,
      cancellationPolicy: settingsRow.cancellation_policy,
    } : seededStudio,
    services: (servicesResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      bodyArea: row.body_area,
      category: row.category as Service["category"],
      durationMinutes: row.duration_minutes,
      priceCents: row.price_cents,
      minPriceCents: row.min_price_cents,
      maxPriceCents: row.max_price_cents,
      priceUnit: row.price_unit,
      isActive: row.is_active,
    })),
    staff: (staffResult.data ?? []).map((row) => ({
      id: row.user_id,
      displayName: row.display_name,
      role: row.role,
      active: row.active,
      color: row.color,
    })),
    serviceAssignments: (assignmentResult.data ?? []).map((row) => ({ serviceId: row.service_id, staffId: row.staff_id })),
    stations: stationResult.data ?? [],
    closures: (closureResult.data ?? []).map((row) => ({ id: row.id, startsAt: row.starts_at, endsAt: row.ends_at, reason: row.reason })),
    availability: (availabilityResult.data ?? []).map((row) => ({ id: row.id, staffId: row.staff_id, weekday: row.weekday, startsAt: row.starts_at, endsAt: row.ends_at, availabilityDate: row.availability_date })),
    error: errors.map((error) => error?.message).filter(Boolean).join(" ") || null,
  };
}

export async function getStaffData(
  scope: StaffDataScope = "all",
  reportRange?: { startUtc: string; endUtc: string },
  session?: Pick<StaffSession, "userId" | "role">,
) {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return {
      ...emptyData,
      error: "Supabase is not configured. Add the required environment values and restart the application.",
    };
  const includes = (...scopes: StaffDataScope[]) =>
    scope === "all" || scopes.includes(scope);
  const needsReferenceData = includes("overview", "calendar", "sales", "settings");
  const emptyMany = Promise.resolve({ data: [] as never[], error: null, count: null });
  const emptySingle = Promise.resolve({ data: null, error: null, count: null });
  const today = manilaDayBounds();
  const [
    referenceData,
    bookingsResult,
    customersResult,
    customerCountResult,
    directoryResult,
    salesResult,
    deliveryResult,
    reportResult,
  ] = await Promise.all([
    needsReferenceData
      ? session
        ? getCachedStaffReferenceData(scope)
        : Promise.resolve({ ...emptyReferenceData, error: "An active staff session is required." })
      : Promise.resolve(emptyReferenceData),
    includes("overview")
      ? supabase
          .from("bookings")
          .select(bookingDetailSelect)
          .gte("starts_at", today.start)
          .lt("starts_at", today.end)
          .order("starts_at")
          .limit(200)
      : emptyMany,
    emptyMany,
    includes("overview")
      ? supabase.from("customers").select("id", { count: "exact", head: true })
      : emptySingle,
    includes("clients")
      ? supabase
          .from("customer_directory")
          .select("id,first_name,last_name,email,phone,created_at,appointment_count,last_appointment_at")
          .order("created_at", { ascending: false })
          .limit(25)
      : emptyMany,
    includes("overview", "sales")
      ? supabase
          .from("sales")
          .select(saleDetailSelect)
          .gte("created_at", scope === "overview" ? today.start : "1970-01-01T00:00:00.000Z")
          .order("created_at", { ascending: false })
          .limit(scope === "overview" ? 100 : 25)
      : emptyMany,
    includes("overview", "settings")
      ? supabase
          .from("notification_deliveries")
          .select("id,kind,recipient,status,last_error,created_at")
          .order("created_at", { ascending: false })
          .limit(25)
      : emptyMany,
    includes("reports")
      ? reportRange
        ? supabase.rpc("studio_report", {
            p_start: reportRange.startUtc,
            p_end: reportRange.endUtc,
          })
        : supabase.rpc("studio_report")
      : emptySingle,
  ]);
  const bookings: BookingRecord[] = (bookingsResult.data ?? []).map((row) => mapBookingRow(row as Record<string, unknown>));
  const directoryCustomers: CustomerRecord[] = (directoryResult.data ?? []).map((row) => {
    const contact = customerDisplayContact(row.email, row.phone);
    return {
      id: row.id,
      name: customerDisplayName(row.first_name, row.last_name),
      ...contact,
      createdAt: row.created_at,
      appointmentCount: Number(row.appointment_count ?? 0),
      lastActivityAt: row.last_appointment_at ?? null,
    };
  });
  const sales: SaleRecord[] = (salesResult.data ?? []).map((row) => mapSaleRow(row as Record<string, unknown>));
  const deliveries: DeliveryRecord[] = (deliveryResult.data ?? []).map(
    (row) => ({
      id: row.id,
      kind: row.kind,
      recipient: row.recipient,
      status: row.status,
      lastError: row.last_error,
      createdAt: row.created_at,
    }),
  );
  const report = (reportResult.data ?? null) as {
    revenue_cents?: number;
    completed_sales?: number;
    sale_count?: number;
    booking_count?: number;
    booking_statuses?: Record<string, number>;
    methods?: Record<string, number>;
  } | null;
  const queryErrors = [
    bookingsResult.error,
    customersResult.error,
    customerCountResult.error,
    directoryResult.error,
    salesResult.error,
    deliveryResult.error,
    reportResult.error,
  ].filter((error): error is NonNullable<typeof error> => Boolean(error));
  return {
    studio: referenceData.studio,
    services: referenceData.services,
    bookings,
    customers: directoryCustomers,
    sales,
    staff: referenceData.staff,
    serviceAssignments: referenceData.serviceAssignments,
    deliveries,
    stations: referenceData.stations,
    closures: referenceData.closures,
    availability: referenceData.availability,
    customerCount: customerCountResult.count ?? directoryCustomers.length,
    bookingStatusCounts: report?.booking_statuses ?? {},
    paymentMethodTotals: report?.methods ?? {},
    completedRevenueCents: Number(report?.revenue_cents ?? 0),
    completedSaleCount: Number(report?.completed_sales ?? 0),
    reportSaleCount: Number(report?.sale_count ?? 0),
    reportBookingCount: Number(report?.booking_count ?? 0),
    error: [referenceData.error, ...queryErrors.map((error) => error.message)].filter(Boolean).join(" ") || null,
  };
}
