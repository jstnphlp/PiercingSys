import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BookingStatus,
  PaymentMethod,
  SaleStatus,
  Service,
  StudioSettings,
} from "@/lib/domain";
import { seededStudio } from "@/lib/data/public";

export type BookingRecord = {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  customer: { id: string; name: string; email: string; phone: string };
  service: {
    id: string;
    name: string;
    priceCents: number | null;
    durationMinutes: number;
  };
  piercer: { id: string; name: string; color: string } | null;
  station: string | null;
};
export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
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

type Relation = Record<string, unknown> | Array<Record<string, unknown>> | null;
function one(value: Relation) {
  return Array.isArray(value) ? value[0] : value;
}

export type StaffDataScope =
  | "overview"
  | "calendar"
  | "clients"
  | "sales"
  | "reports"
  | "settings"
  | "all";

export async function getStaffData(scope: StaffDataScope = "all") {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return {
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
      error: "Supabase is not configured. Add the required environment values and restart the application.",
    };
  const includes = (...scopes: StaffDataScope[]) =>
    scope === "all" || scopes.includes(scope);
  const emptyMany = Promise.resolve({ data: [], error: null });
  const emptySingle = Promise.resolve({ data: null, error: null });
  const [
    settingsResult,
    servicesResult,
    bookingsResult,
    customersResult,
    salesResult,
    staffResult,
    assignmentResult,
    deliveryResult,
    stationResult,
    closureResult,
  ] = await Promise.all([
    includes("overview", "settings")
      ? supabase.from("studio_settings").select("*").eq("id", 1).single()
      : emptySingle,
    includes("overview", "sales", "settings")
      ? supabase.from("services").select("*").order("sort_order")
      : emptyMany,
    includes("overview", "calendar", "clients")
      ? supabase
          .from("bookings")
          .select(
            "id,reference,status,starts_at,ends_at,notes,customers(id,first_name,last_name,email,phone),services(id,name,price_cents,duration_minutes),staff_profiles!bookings_assigned_piercer_id_fkey(user_id,display_name,color),stations(name)",
          )
          .order("starts_at")
          .limit(300)
      : emptyMany,
    includes("clients", "sales")
      ? supabase
          .from("customers")
          .select("id,first_name,last_name,email,phone,created_at")
          .order("created_at", { ascending: false })
          .limit(300)
      : emptyMany,
    includes("overview", "sales", "reports")
      ? supabase
          .from("sales")
          .select(
            "id,reference,status,total_cents,created_at,customers(first_name,last_name),payments(method,amount_cents),sale_adjustments(kind,amount_cents)",
          )
          .order("created_at", { ascending: false })
          .limit(300)
      : emptyMany,
    includes("overview", "settings")
      ? supabase
          .from("staff_profiles")
          .select("user_id,display_name,role,active,color")
          .order("created_at")
      : emptyMany,
    includes("overview", "settings")
      ? supabase.from("service_staff").select("service_id,staff_id")
      : emptyMany,
    includes("overview", "settings")
      ? supabase
          .from("notification_deliveries")
          .select("id,kind,recipient,status,last_error,created_at")
          .order("created_at", { ascending: false })
          .limit(25)
      : emptyMany,
    includes("settings")
      ? supabase
          .from("stations")
          .select("id,name")
          .eq("active", true)
          .order("name")
      : emptyMany,
    includes("settings")
      ? supabase
          .from("closures")
          .select("id,starts_at,ends_at,reason")
          .order("starts_at", { ascending: false })
          .limit(100)
      : emptyMany,
  ]);
  const settingsRow = settingsResult.data;
  const studio: StudioSettings = settingsRow
    ? {
        id: settingsRow.id,
        name: settingsRow.name,
        location: settingsRow.location,
        address: settingsRow.address,
        email: settingsRow.email,
        phone: settingsRow.phone,
        instagramUrl: settingsRow.instagram_url,
        timezone: "Asia/Manila",
        currency: "PHP",
        businessHours: settingsRow.business_hours,
        bookingIntervalMinutes: settingsRow.booking_interval_minutes,
        minimumLeadHours: settingsRow.minimum_lead_hours,
        bookingHorizonDays: settingsRow.booking_horizon_days,
        minimumAge: settingsRow.minimum_age,
        cancellationPolicy: settingsRow.cancellation_policy,
      }
    : seededStudio;
  const services: Service[] = (servicesResult.data ?? []).map((row) => ({
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
  }));
  const bookings: BookingRecord[] = (bookingsResult.data ?? []).map((row) => {
    const customer = one(row.customers as Relation);
    const service = one(row.services as Relation);
    const piercer = one(row.staff_profiles as Relation);
    const station = one(row.stations as Relation);
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      notes: row.notes,
      customer: {
        id: String(customer?.id ?? ""),
        name: `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim(),
        email: String(customer?.email ?? ""),
        phone: String(customer?.phone ?? ""),
      },
      service: {
        id: String(service?.id ?? ""),
        name: String(service?.name ?? "Service"),
        priceCents:
          service?.price_cents === null || service?.price_cents === undefined
            ? null
            : Number(service.price_cents),
        durationMinutes: Number(service?.duration_minutes ?? 0),
      },
      piercer: piercer
        ? {
            id: String(piercer.user_id),
            name: String(piercer.display_name),
            color: String(piercer.color),
          }
        : null,
      station: station ? String(station.name) : null,
    };
  });
  const customers: CustomerRecord[] = (customersResult.data ?? []).map(
    (row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
    }),
  );
  const sales: SaleRecord[] = (salesResult.data ?? []).map((row) => {
    const customer = one(row.customers as Relation);
    const payments = (row.payments ?? []) as Array<{
      method: PaymentMethod;
      amount_cents: number;
    }>;
    const adjustments = (row.sale_adjustments ?? []) as Array<{
      amount_cents: number;
    }>;
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      customerName: customer
        ? `${customer.first_name} ${customer.last_name}`
        : "Walk-in",
      methods: payments.map((item) => item.method),
      paidCents: payments.reduce((sum, item) => sum + item.amount_cents, 0),
      adjustmentCents: adjustments.reduce(
        (sum, item) => sum + item.amount_cents,
        0,
      ),
    };
  });
  const staff: StaffRecord[] = (staffResult.data ?? []).map((row) => ({
    id: row.user_id,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    color: row.color,
  }));
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
  const closures: ClosureRecord[] = (closureResult.data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
  }));
  const queryErrors = [
    settingsResult.error,
    servicesResult.error,
    bookingsResult.error,
    customersResult.error,
    salesResult.error,
    staffResult.error,
    assignmentResult.error,
    deliveryResult.error,
    stationResult.error,
    closureResult.error,
  ].filter((error): error is NonNullable<typeof error> => Boolean(error));
  return {
    studio,
    services,
    bookings,
    customers,
    sales,
    staff,
    serviceAssignments: (assignmentResult.data ?? []).map((row) => ({
      serviceId: row.service_id,
      staffId: row.staff_id,
    })),
    deliveries,
    stations: stationResult.data ?? [],
    closures,
    error: queryErrors.length
      ? queryErrors.map((error) => error.message).join(" ")
      : null,
  };
}
