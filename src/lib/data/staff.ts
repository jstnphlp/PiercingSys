import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BookingStatus,
  PaymentMethod,
  SaleStatus,
  Service,
  StudioSettings,
} from "@/lib/domain";
import { manilaDayBounds } from "@/lib/domain";
import { pageMeta, type PageMeta } from "@/lib/pagination";
import { seededStudio } from "@/lib/data/public";
import type { ReportPeriod } from "@/lib/report-period";
import { measureServerTiming } from "@/lib/server-timing";
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
export type CalendarAppointmentRecord = {
  id: string;
  reference: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  assigned_piercer_id: string;
  station_id: string | null;
  customers: { id: string; first_name: string; last_name: string; email: string; phone: string } | Array<{ id: string; first_name: string; last_name: string; email: string; phone: string }>;
  booking_services: Array<{ id: string; service_id: string; position: number; name: string; duration_minutes: number }>;
  staff_profiles: { user_id: string; display_name: string; color: string } | Array<{ user_id: string; display_name: string; color: string }> | null;
  stations: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  sales: { id: string; status: string } | Array<{ id: string; status: string }> | null;
};

export const saleDetailSelect =
  "id,reference,status,total_cents,created_at,booking_id,customer_id,customers(first_name,last_name),payments(method,amount_cents),sale_adjustments(kind,amount_cents),sale_items(id,description,unit_price_cents,min_price_cents,max_price_cents)";

export const bookingDetailSelect =
  "id,reference,status,starts_at,ends_at,notes,customers(id,first_name,last_name,email,phone),booking_services(id,service_id,position,name,price_cents,min_price_cents,max_price_cents,price_unit,duration_minutes),staff_profiles!bookings_assigned_piercer_id_fkey(user_id,display_name,color),stations(name),sales(id,status)";

const overviewBookingSelect =
  "id,reference,status,starts_at,ends_at,notes,customers(id,first_name,last_name,email,phone),booking_services(service_id,position,name),staff_profiles!bookings_assigned_piercer_id_fkey(user_id,display_name,color),stations(name),sales(status)";

export const calendarAppointmentSelect =
  "id,reference,status,starts_at,ends_at,notes,station_id,assigned_piercer_id,customers(id,first_name,last_name,email,phone),booking_services(id,service_id,position,name,duration_minutes),staff_profiles!bookings_assigned_piercer_id_fkey(user_id,display_name,color),stations(id,name),sales(id,status)";

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

type DataResult<T> = T & { error: string | null };
type QueryError = { message: string } | null | undefined;

function errors(...values: Array<QueryError | string>) {
  return values
    .map((value) => typeof value === "string" ? value : value?.message)
    .filter(Boolean)
    .join(" ") || null;
}

async function getStudioReference(): Promise<DataResult<{ studio: StudioSettings }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { studio: seededStudio, error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.studio", () => admin
    .from("studio_settings")
    .select("id,name,location,address,email,phone,instagram_url,business_hours,booking_interval_minutes,minimum_lead_hours,booking_horizon_days,minimum_age,cancellation_policy")
    .eq("id", 1)
    .single());
  const row = result.data;
  return {
    studio: row ? {
      id: row.id,
      name: row.name,
      location: row.location,
      address: row.address,
      email: row.email,
      phone: row.phone,
      instagramUrl: row.instagram_url,
      timezone: "Asia/Manila" as const,
      currency: "PHP" as const,
      businessHours: row.business_hours,
      bookingIntervalMinutes: row.booking_interval_minutes,
      minimumLeadHours: row.minimum_lead_hours,
      bookingHorizonDays: row.booking_horizon_days,
      minimumAge: row.minimum_age,
      cancellationPolicy: row.cancellation_policy,
    } : seededStudio,
    error: errors(result.error),
  };
}

async function getServicesReference(): Promise<DataResult<{ services: Service[] }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { services: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.services", () => admin
    .from("services")
    .select("id,name,description,body_area,category,duration_minutes,price_cents,min_price_cents,max_price_cents,price_unit,is_active,sort_order")
    .order("sort_order"));
  return {
    services: (result.data ?? []).map((row) => ({
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
    error: errors(result.error),
  };
}

async function getStaffReference(): Promise<DataResult<{ staff: StaffRecord[] }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { staff: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.team", () => admin
    .from("staff_profiles")
    .select("user_id,display_name,role,active,color")
    .order("created_at"));
  return {
    staff: (result.data ?? []).map((row) => ({
      id: row.user_id,
      displayName: row.display_name,
      role: row.role,
      active: row.active,
      color: row.color,
    })),
    error: errors(result.error),
  };
}

async function getServiceAssignmentsReference(): Promise<DataResult<{ serviceAssignments: Array<{ serviceId: string; staffId: string }> }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { serviceAssignments: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.assignments", () => admin
    .from("service_staff")
    .select("service_id,staff_id"));
  return {
    serviceAssignments: (result.data ?? []).map((row) => ({ serviceId: row.service_id, staffId: row.staff_id })),
    error: errors(result.error),
  };
}

async function getStationsReference(): Promise<DataResult<{ stations: Array<{ id: string; name: string }> }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { stations: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.stations", () => admin
    .from("stations")
    .select("id,name")
    .eq("active", true)
    .order("name"));
  return { stations: result.data ?? [], error: errors(result.error) };
}

async function getAvailabilityReference(): Promise<DataResult<{ availability: AvailabilityRecord[] }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { availability: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.availability", () => admin
    .from("staff_availability")
    .select("id,staff_id,weekday,starts_at,ends_at,availability_date")
    .order("weekday")
    .order("starts_at"));
  return {
    availability: (result.data ?? []).map((row) => ({
      id: row.id,
      staffId: row.staff_id,
      weekday: row.weekday,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      availabilityDate: row.availability_date,
    })),
    error: errors(result.error),
  };
}

async function getClosuresReference(): Promise<DataResult<{ closures: ClosureRecord[] }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("staff-reference");

  const admin = createSupabaseAdminClient();
  if (!admin) return { closures: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reference.closures", () => admin
    .from("closures")
    .select("id,starts_at,ends_at,reason")
    .order("starts_at", { ascending: false })
    .limit(100));
  return {
    closures: (result.data ?? []).map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reason: row.reason,
    })),
    error: errors(result.error),
  };
}

export async function getOverviewBookings(): Promise<DataResult<{ bookings: BookingRecord[] }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { bookings: [], error: "Supabase is not configured." };
  const today = manilaDayBounds();
  const result = await measureServerTiming("staff.overview.bookings", () => supabase
    .from("bookings")
    .select(overviewBookingSelect)
    .gte("starts_at", today.start)
    .lt("starts_at", today.end)
    .order("starts_at")
    .limit(200));
  return {
    bookings: (result.data ?? []).map((row) => mapBookingRow(row as Record<string, unknown>)),
    error: errors(result.error),
  };
}

export async function getOverviewCustomerCount(): Promise<DataResult<{ customerCount: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { customerCount: 0, error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.overview.customerCount", () => supabase
    .from("customers")
    .select("id", { count: "exact", head: true }));
  return { customerCount: result.count ?? 0, error: errors(result.error) };
}

export async function getOverviewRevenue(): Promise<DataResult<{ completedRevenueCents: number; completedSaleCount: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { completedRevenueCents: 0, completedSaleCount: 0, error: "Supabase is not configured." };
  const today = manilaDayBounds();
  const result = await measureServerTiming("staff.overview.revenue", () => supabase
    .from("sales")
    .select("total_cents,sale_adjustments(amount_cents)")
    .eq("status", "completed")
    .gte("created_at", today.start)
    .lt("created_at", today.end));
  const rows = result.data ?? [];
  const completedRevenueCents = rows.reduce((total, row) => {
    const adjusted = (row.sale_adjustments ?? []).reduce(
      (sum, adjustment) => sum + adjustment.amount_cents,
      0,
    );
    return total + row.total_cents - adjusted;
  }, 0);
  return {
    completedRevenueCents,
    completedSaleCount: rows.length,
    error: errors(result.error),
  };
}

export async function getOverviewReadiness(
  includeNotifications: boolean,
): Promise<DataResult<{
  studio: StudioSettings;
  services: Service[];
  staff: StaffRecord[];
  serviceAssignments: Array<{ serviceId: string; staffId: string }>;
  pendingDeliveryCount: number;
}>> {
  const deliveryPromise = includeNotifications
    ? getPendingDeliveryCount()
    : Promise.resolve({ pendingDeliveryCount: 0, error: null });
  const [studio, services, staff, assignments, deliveries] = await Promise.all([
    getStudioReference(),
    getServicesReference(),
    getStaffReference(),
    getServiceAssignmentsReference(),
    deliveryPromise,
  ]);
  return {
    studio: studio.studio,
    services: services.services,
    staff: staff.staff,
    serviceAssignments: assignments.serviceAssignments,
    pendingDeliveryCount: deliveries.pendingDeliveryCount,
    error: errors(studio.error ?? "", services.error ?? "", staff.error ?? "", assignments.error ?? "", deliveries.error ?? ""),
  };
}

async function getPendingDeliveryCount(): Promise<DataResult<{ pendingDeliveryCount: number }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { pendingDeliveryCount: 0, error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.overview.deliveryCount", () => supabase
    .from("notification_deliveries")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "failed"]));
  return { pendingDeliveryCount: result.count ?? 0, error: errors(result.error) };
}

export async function getCalendarReferenceData() {
  const [studio, services, staff, assignments, stations, availability] = await Promise.all([
    getStudioReference(),
    getServicesReference(),
    getStaffReference(),
    getServiceAssignmentsReference(),
    getStationsReference(),
    getAvailabilityReference(),
  ]);
  return {
    studio: studio.studio,
    services: services.services,
    staff: staff.staff,
    serviceAssignments: assignments.serviceAssignments,
    stations: stations.stations,
    availability: availability.availability,
    error: errors(studio.error ?? "", services.error ?? "", staff.error ?? "", assignments.error ?? "", stations.error ?? "", availability.error ?? ""),
  };
}

export async function getCalendarAppointments({
  from,
  to,
  piercerId,
  stationId,
}: {
  from: string;
  to: string;
  piercerId?: string;
  stationId?: string;
}): Promise<DataResult<{ appointments: CalendarAppointmentRecord[] }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { appointments: [], error: "Supabase is not configured." };
  let query = supabase
    .from("bookings")
    .select(calendarAppointmentSelect)
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at");
  if (piercerId) query = query.eq("assigned_piercer_id", piercerId);
  if (stationId) query = query.eq("station_id", stationId);
  const result = await measureServerTiming("staff.calendar.appointments", () => query);
  return {
    appointments: (result.data ?? []) as unknown as CalendarAppointmentRecord[],
    error: errors(result.error),
  };
}

export async function getClientsPage(): Promise<DataResult<{ customers: CustomerRecord[]; page: PageMeta }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { customers: [], page: pageMeta(1, 25, 0), error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.clients.page", () => supabase
    .from("customer_directory")
    .select("id,first_name,last_name,email,phone,created_at,appointment_count,last_appointment_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, 24));
  const customers: CustomerRecord[] = (result.data ?? []).map((row) => {
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
  return { customers, page: pageMeta(1, 25, result.count ?? 0), error: errors(result.error) };
}

export async function getSalesPage(): Promise<DataResult<{ sales: SaleRecord[]; services: Service[]; page: PageMeta }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { sales: [], services: [], page: pageMeta(1, 25, 0), error: "Supabase is not configured." };
  const [services, salesResult] = await Promise.all([
    getServicesReference(),
    measureServerTiming("staff.sales.page", () => supabase
      .from("sales")
      .select(saleDetailSelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 24)),
  ]);
  return {
    services: services.services,
    sales: (salesResult.data ?? []).map((row) => mapSaleRow(row as Record<string, unknown>)),
    page: pageMeta(1, 25, salesResult.count ?? 0),
    error: errors(services.error ?? "", salesResult.error),
  };
}

export type StaffReportData = {
  bookingStatusCounts: Record<string, number>;
  paymentMethodTotals: Record<string, number>;
  completedRevenueCents: number;
  completedSaleCount: number;
  reportSaleCount: number;
  reportBookingCount: number;
};

export async function getReportsData(
  reportRange: Pick<ReportPeriod, "startUtc" | "endUtc">,
): Promise<DataResult<StaffReportData>> {
  const supabase = await createSupabaseServerClient();
  const emptyReport = {
    bookingStatusCounts: {},
    paymentMethodTotals: {},
    completedRevenueCents: 0,
    completedSaleCount: 0,
    reportSaleCount: 0,
    reportBookingCount: 0,
  };
  if (!supabase) return { ...emptyReport, error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.reports.summary", () => supabase.rpc("studio_report", {
    p_start: reportRange.startUtc,
    p_end: reportRange.endUtc,
  }));
  const report = (result.data ?? null) as {
    revenue_cents?: number;
    completed_sales?: number;
    sale_count?: number;
    booking_count?: number;
    booking_statuses?: Record<string, number>;
    methods?: Record<string, number>;
  } | null;
  return {
    bookingStatusCounts: report?.booking_statuses ?? {},
    paymentMethodTotals: report?.methods ?? {},
    completedRevenueCents: Number(report?.revenue_cents ?? 0),
    completedSaleCount: Number(report?.completed_sales ?? 0),
    reportSaleCount: Number(report?.sale_count ?? 0),
    reportBookingCount: Number(report?.booking_count ?? 0),
    error: errors(result.error),
  };
}

export async function getSettingsStudioData() {
  return getStudioReference();
}

export async function getSettingsScheduleData() {
  const [studio, staff, availability, closures] = await Promise.all([
    getStudioReference(),
    getStaffReference(),
    getAvailabilityReference(),
    getClosuresReference(),
  ]);
  return {
    studio: studio.studio,
    staff: staff.staff,
    availability: availability.availability,
    closures: closures.closures,
    error: errors(studio.error ?? "", staff.error ?? "", availability.error ?? "", closures.error ?? ""),
  };
}

export async function getSettingsServicesData() {
  const [services, staff, assignments] = await Promise.all([
    getServicesReference(),
    getStaffReference(),
    getServiceAssignmentsReference(),
  ]);
  return {
    services: services.services,
    staff: staff.staff,
    serviceAssignments: assignments.serviceAssignments,
    error: errors(services.error ?? "", staff.error ?? "", assignments.error ?? ""),
  };
}

export async function getSettingsTeamData() {
  const [staff, stations] = await Promise.all([
    getStaffReference(),
    getStationsReference(),
  ]);
  return {
    staff: staff.staff,
    stations: stations.stations,
    error: errors(staff.error ?? "", stations.error ?? ""),
  };
}

export async function getSettingsDeliveries(): Promise<DataResult<{ deliveries: DeliveryRecord[] }>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { deliveries: [], error: "Supabase is not configured." };
  const result = await measureServerTiming("staff.settings.deliveries", () => supabase
    .from("notification_deliveries")
    .select("id,kind,recipient,status,last_error,created_at")
    .order("created_at", { ascending: false })
    .limit(6));
  return {
    deliveries: (result.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      recipient: row.recipient,
      status: row.status,
      lastError: row.last_error,
      createdAt: row.created_at,
    })),
    error: errors(result.error),
  };
}
