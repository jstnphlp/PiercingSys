import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { getStaffSession, type StaffSession } from "@/lib/auth";
import {
  formatPhp,
  manilaDate,
  manilaDateTime,
  manilaWeekDates,
  shiftManilaDate,
} from "@/lib/domain";
import {
  getCalendarAppointments,
  getCalendarReferenceData,
  getClientsPage,
  getOverviewBookings,
  getOverviewCustomerCount,
  getOverviewReadiness,
  getOverviewRevenue,
  getReportsData,
  getSalesPage,
  getSettingsDeliveries,
  getSettingsScheduleData,
  getSettingsServicesData,
  getSettingsStudioData,
  getSettingsTeamData,
} from "@/lib/data/staff";
import { resolveReportPeriod, type ReportPeriod, type ReportPreset } from "@/lib/report-period";
import {
  InviteForm,
  ServiceAssignmentForm,
  ServiceForm,
  SettingsForm,
  StaffActions,
  StationForm,
} from "./controls";
import { CalendarWorkspace } from "./calendar-workspace";
import { ClientRecords } from "./client-records";
import { ScheduleSettings } from "./schedule-settings";
import { ReportsView } from "./reports-view";
import { SalesView } from "./sales-view";
import { ServiceList } from "./service-list";
import {
  OverviewAppointmentsSkeleton,
  OverviewMetricsSkeleton,
  OverviewReadinessSkeleton,
  SettingsFormSkeleton,
  SettingsListSkeleton,
  SettingsNotificationSkeleton,
  SettingsScheduleSkeleton,
  StaffViewSkeleton,
} from "./staff-skeletons";
import { SettingsSectionFocus, type SettingsSection } from "./settings-section-focus";
import { TodayAppointments } from "./appointment-list";
import { emptyState, featureView, metricCard, metricGrid, panel, panelHead, settingSection, settingsListRow, settingsStack, statusClasses, statusNote, twoPanel } from "./dashboard-styles";
import { allowedViews, type StaffView } from "./view-config";

type StaffSearchParams = {
  section?: string;
  period?: string;
  from?: string;
  to?: string;
};

export function StaffViewPage({
  view,
  searchParams = Promise.resolve({}),
}: {
  view: StaffView;
  searchParams?: Promise<StaffSearchParams>;
}) {
  return (
    <Suspense
      fallback={<StaffViewSkeleton view={view} label={`Loading ${view}`} />}
    >
      <AuthorizedStaffView view={view} searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthorizedStaffView({
  view,
  searchParams,
}: {
  view: StaffView;
  searchParams: Promise<StaffSearchParams>;
}) {
  await connection();

  const [session, params] = await Promise.all([getStaffSession(), searchParams]);
  if (!session) redirect("/login");
  if (!allowedViews(session.role).includes(view)) redirect("/app");
  const reportPeriod = view === "reports" ? resolveReportPeriod(params) : null;
  const settingsSection = view === "settings" ? resolveSettingsSection(params.section) : null;
  return viewContent(view, settingsSection, session, reportPeriod);
}

function viewContent(
  view: StaffView,
  settingsSection: SettingsSection | null,
  session: StaffSession,
  reportPeriod: ReportPeriod | null,
) {
  const role = session.role;
  if (view === "overview") return <Overview role={role} />;
  if (view === "calendar")
    return <Suspense fallback={<StaffViewSkeleton view="calendar" label="Loading calendar" />}><Calendar role={role} userId={session.userId} /></Suspense>;
  if (view === "clients") return <Suspense fallback={<StaffViewSkeleton view="clients" label="Loading clients" />}><Clients role={role} /></Suspense>;
  if (view === "sales") return <Suspense fallback={<StaffViewSkeleton view="sales" label="Loading sales" />}><Sales /></Suspense>;
  if (view === "reports" && reportPeriod) return <Suspense fallback={<StaffViewSkeleton view="reports" label="Loading reports" />}><Reports period={reportPeriod} /></Suspense>;
  return <StudioSettings role={role} section={settingsSection} />;
}

function Overview({ role }: { role: string }) {
  const bookings = getOverviewBookings();
  const customerCount = getOverviewCustomerCount();
  const revenue = role === "piercer"
    ? Promise.resolve({ completedRevenueCents: 0, completedSaleCount: 0, error: null })
    : getOverviewRevenue();

  return (
    <div className={featureView}>
      <Suspense fallback={<OverviewMetricsSkeleton />}>
        <OverviewMetrics bookings={bookings} customerCount={customerCount} revenue={revenue} role={role} />
      </Suspense>
      <div className={`${twoPanel} items-start`}>
        <Suspense fallback={<OverviewAppointmentsSkeleton />}>
          <OverviewAppointments bookings={bookings} role={role} />
        </Suspense>
        <Suspense fallback={<OverviewReadinessSkeleton />}>
          <OverviewReadiness role={role} />
        </Suspense>
      </div>
    </div>
  );
}

async function OverviewMetrics({
  bookings,
  customerCount,
  revenue,
  role,
}: {
  bookings: ReturnType<typeof getOverviewBookings>;
  customerCount: ReturnType<typeof getOverviewCustomerCount>;
  revenue: ReturnType<typeof getOverviewRevenue>;
  role: string;
}) {
  const [bookingData, customerData, revenueData] = await Promise.all([
    bookings,
    customerCount,
    revenue,
  ]);
  const error = [bookingData.error, customerData.error, revenueData.error].filter(Boolean).join(" ");
  if (error) return <StateCard title="Metrics could not be loaded" detail={error} />;
  const appointments = bookingData.bookings;
  return <div className={metricGrid}>
    <Metric icon={<CalendarDays />} label="Appointments" value={String(appointments.length)} note="Today in Manila" />
    <Metric icon={<Clock3 />} label="Confirmed" value={String(appointments.filter((item) => item.status === "confirmed").length)} note="Ready for the studio" />
    <Metric icon={<UsersRound />} label="Clients" value={String(customerData.customerCount)} note="Stored records" />
    {role !== "piercer" && <Metric icon={<CircleDollarSign />} label="Collected" value={formatPhp(revenueData.completedRevenueCents)} note={`${revenueData.completedSaleCount} completed sales`} />}
  </div>;
}

async function OverviewAppointments({
  bookings,
  role,
}: {
  bookings: ReturnType<typeof getOverviewBookings>;
  role: string;
}) {
  const data = await bookings;
  return data.error
    ? <StateCard title="Appointments could not be loaded" detail={data.error} />
    : <TodayAppointments bookings={data.bookings} role={role} />;
}

async function OverviewReadiness({ role }: { role: string }) {
  const data = await getOverviewReadiness(role !== "piercer");
  if (data.error) return <StateCard title="Studio readiness could not be loaded" detail={data.error} />;
  const activeServices = data.services.filter((item) => item.isActive);
  const hasActiveServices = activeServices.length > 0;
  const hasQualifiedStaff = hasActiveServices && activeServices.every((service) =>
    data.serviceAssignments.some((assignment) =>
      assignment.serviceId === service.id &&
      data.staff.some(
        (person) =>
          person.id === assignment.staffId &&
          person.active &&
          person.role === "piercer",
      ),
    ),
  );
  return (
        <section className={panel}>
          <PanelHead
            title="Studio readiness"
            detail="Items affecting daily operations"
          />
          <div className="flex flex-col [&>a:last-child]:border-b-0 [&_strong]:text-[10px] [&_small]:text-[8px] [&_small]:text-studio-muted">
            <Readiness
              label="Business hours"
              done={Object.keys(data.studio.businessHours).length > 0}
              section="hours"
            />
            <Readiness
              label="Active services"
              done={hasActiveServices}
              detail={hasActiveServices ? undefined : "No active services available"}
              section="services"
            />
            <Readiness
              label="Qualified staff"
              done={hasQualifiedStaff}
              detail={hasQualifiedStaff ? undefined : "A service needs an assigned piercer"}
              section="team"
            />
            {role !== "piercer" && (
              <Readiness
                label="Email deliveries"
                done={data.pendingDeliveryCount === 0}
                detail={
                  data.pendingDeliveryCount
                    ? `${data.pendingDeliveryCount} need attention`
                    : "All clear"
                }
                section="notifications"
              />
            )}
          </div>
        </section>
  );
}

async function Calendar({ role, userId }: { role: string; userId: string }) {
  const now = new Date();
  const initialDate = manilaDate(now);
  const initialDays = manilaWeekDates(initialDate);
  const initialFrom = manilaDateTime(initialDays[0], "00:00").toISOString();
  const nextDay = shiftManilaDate(initialDays.at(-1)!, 1);
  const initialTo = new Date(manilaDateTime(nextDay, "00:00").getTime() - 1).toISOString();
  const [data, appointmentData] = await Promise.all([
    getCalendarReferenceData(),
    getCalendarAppointments({
      from: initialFrom,
      to: initialTo,
      piercerId: role === "piercer" ? userId : undefined,
    }),
  ]);
  const error = [data.error, appointmentData.error].filter(Boolean).join(" ");
  if (error) return <StateCard title="Calendar could not be loaded" detail={error} />;
  return <CalendarWorkspace role={role} userId={userId} services={data.services} staff={data.staff} assignments={data.serviceAssignments} stations={data.stations} studio={data.studio} availability={data.availability} initialDate={initialDate} initialNow={now.toISOString()} initialAppointments={appointmentData.appointments} />;
}

async function Clients({ role }: { role: string }) {
  const data = await getClientsPage();
  if (data.error) return <StateCard title="Clients could not be loaded" detail={data.error} />;
  return (
    <div className={featureView}>
      <ClientRecords
        customers={data.customers}
        initialPage={data.page}
        canCreate={role === "owner" || role === "manager"}
      />
    </div>
  );
}

async function Sales() {
  const data = await getSalesPage();
  if (data.error) return <StateCard title="Sales could not be loaded" detail={data.error} />;
  return <SalesView initialSales={data.sales} initialPage={data.page} services={data.services} />;
}

const reportPresets: Array<{ value: ReportPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

async function Reports({ period }: { period: ReportPeriod }) {
  const data = await getReportsData(period);
  if (data.error) return <StateCard title="Reports could not be loaded" detail={data.error} />;
  const presetLinks = reportPresets.map((item) => {
    const resolved = resolveReportPeriod({ period: item.value });
    return {
      ...item,
      href: item.value === "custom"
        ? `/app/reports?period=custom&from=${period.from}&to=${period.to}`
        : `/app/reports?period=${item.value}&from=${resolved.from}&to=${resolved.to}`,
    };
  });
  return <ReportsView
    initialPeriod={period}
    presets={presetLinks}
    initialSummary={{
      revenue_cents: data.completedRevenueCents,
      completed_sales: data.completedSaleCount,
      sale_count: data.reportSaleCount,
      booking_count: data.reportBookingCount,
      booking_statuses: data.bookingStatusCounts,
      methods: data.paymentMethodTotals,
    }}
  />;
}

function StudioSettings({
  role,
  section,
}: {
  role: string;
  section: SettingsSection | null;
}) {
  return (
    <div className={featureView}>
      <SettingsSectionFocus section={section} />
      <div className={settingsStack}>
        <Suspense fallback={<SettingsFormSkeleton />}><SettingsGeneral /></Suspense>
        <Suspense fallback={<SettingsScheduleSkeleton />}><SettingsSchedule /></Suspense>
        <Suspense fallback={<SettingsListSkeleton />}><SettingsServices /></Suspense>
        <Suspense fallback={<SettingsListSkeleton rows={5} />}><SettingsTeam role={role} /></Suspense>
        <section className={twoPanel}>
          <div id="studio-settings-notifications" className={settingSection} tabIndex={-1}>
            <PanelHead
              title="Consent records"
              detail="Signed acknowledgements are stored against bookings."
            />
            <p className={`${statusNote} mx-[18px] my-2.5`}>
              Consent records become visible from the associated client and
              appointment once submitted.
            </p>
          </div>
          <Suspense fallback={<SettingsNotificationSkeleton />}><SettingsNotifications /></Suspense>
        </section>
      </div>
    </div>
  );
}

async function SettingsGeneral() {
  const data = await getSettingsStudioData();
  return data.error
    ? <StateCard title="Studio settings could not be loaded" detail={data.error} />
    : <SettingsForm studio={data.studio} />;
}

async function SettingsSchedule() {
  const data = await getSettingsScheduleData();
  return data.error
    ? <StateCard title="Schedule settings could not be loaded" detail={data.error} />
    : <ScheduleSettings studio={data.studio} staff={data.staff} availability={data.availability} closures={data.closures} sectionId="studio-settings-hours" initialDate={manilaDate(new Date())} />;
}

async function SettingsServices() {
  const data = await getSettingsServicesData();
  if (data.error) return <StateCard title="Services could not be loaded" detail={data.error} />;
  return <section id="studio-settings-services" className={settingSection} tabIndex={-1}>
          <PanelHead
            title="Services & pricing"
            detail="Only active, assigned services appear on public booking."
          />
          <div id="studio-settings-assignments" className="flex flex-wrap items-center justify-start gap-2 px-[18px] py-3.5" tabIndex={-1}>
            <ServiceForm staff={data.staff} />
            <ServiceAssignmentForm
              services={data.services}
              staff={data.staff}
              assignments={data.serviceAssignments}
            />
          </div>
          <ServiceList services={data.services} />
        </section>;
}

async function SettingsTeam({ role }: { role: string }) {
  const data = await getSettingsTeamData();
  if (data.error) return <StateCard title="Team settings could not be loaded" detail={data.error} />;
  return <section id="studio-settings-team" className={settingSection} tabIndex={-1}>
          <PanelHead
            title="Team, schedules & stations"
            detail="Owners manage invitations; managers configure operational availability."
          />
          <div className="flex flex-wrap items-center justify-start gap-2 px-[18px] py-3.5">
            {role === "owner" && <InviteForm />}
            <StationForm />
          </div>
          <div>
            {data.staff.map((person) => (
              <StaffActions
                key={person.id}
                person={person}
                currentRole={role as "owner" | "manager" | "piercer"}
              />
            ))}
            {data.stations.map((station) => (
              <div className={settingsListRow} key={station.id}>
                <span>
                  <strong>{station.name}</strong>
                  <small>Active station</small>
                </span>
              </div>
            ))}
          </div>
        </section>;
}

async function SettingsNotifications() {
  const data = await getSettingsDeliveries();
  if (data.error) return <StateCard title="Notification deliveries could not be loaded" detail={data.error} />;
  return <div className={settingSection}>
            <PanelHead
              title="Notification deliveries"
              detail="Confirmation, reschedule, and cancellation email status."
            />
            {data.deliveries.length ? (
              <div className="px-[17px] [&>div]:flex [&>div]:min-h-[50px] [&>div]:items-center [&>div]:gap-[9px] [&>div]:border-b [&>div]:border-dashed [&>div]:border-[#d6a786] [&>div>span:last-child]:flex [&>div>span:last-child]:flex-col [&>div>span:last-child]:text-[9px] [&_small]:mt-[3px] [&_small]:text-danger">
                {data.deliveries.slice(0, 6).map((item) => (
                  <div key={item.id}>
                    <Status value={item.status} />
                    <span>
                      {item.kind} · {item.recipient}
                      {item.lastError && <small>{item.lastError}</small>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`${statusNote} mx-[18px] my-2.5`}>No email deliveries recorded.</p>
            )}
          </div>;
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <section className={metricCard}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </section>
  );
}
function PanelHead({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={panelHead}>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function StateCard({ title, detail }: { title: string; detail: string }) {
  return (
    <section className={`${panel} ${emptyState} [&>svg]:z-1 [&>svg]:mb-3 [&>svg]:size-[45px] [&>svg]:rounded-full [&>svg]:border-[1.5px] [&>svg]:border-hippy-ink [&>svg]:bg-hippy-sage [&>svg]:p-[11px] [&>svg]:text-[#315342] [&>svg]:shadow-[3px_3px_0_#3b2923] [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-[650]`}>
      <Sparkles />
      <h2>{title}</h2>
      <p>{detail}</p>
    </section>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={statusClasses(value)}>{value.replace("_", " ")}</span>
  );
}
function Readiness({
  label,
  done,
  detail,
  section,
}: {
  label: string;
  done: boolean;
  detail?: string;
  section: SettingsSection;
}) {
  const action = done || section === "notifications" ? "Review" : "Configure";
  return (
    <Link
      href={`/app/settings?section=${section}`}
      className="group grid min-h-[61px] grid-cols-[26px_minmax(0,1fr)_auto_14px] items-center gap-x-[9px] border-b border-dashed border-[#d5a684] px-[17px] py-2.5 text-left transition-[background,transform] hover:translate-x-px hover:bg-[#fff1cf] focus-visible:bg-[#fff4d7] focus-visible:outline-3 focus-visible:outline-offset-[-4px] focus-visible:outline-[#efb83f88] max-[450px]:grid-cols-[26px_minmax(0,1fr)_14px] max-[450px]:gap-y-0.5"
      aria-label={`${action} ${label}: ${detail ?? (done ? "Configured" : "Needs setup")}`}
    >
      <span className={`${done ? "bg-hippy-sage text-[#274c3c]" : "bg-hippy-gold text-[#664219]"} row-span-2 grid size-6 place-items-center rounded-full border border-hippy-ink text-[10px] font-black shadow-[1px_1px_0_#3b2923]`}>{done ? "✓" : "!"}</span>
      <span className="flex min-w-0 flex-col">
        <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</strong>
        <small>{detail ?? (done ? "Configured" : "Needs setup")}</small>
      </span>
      <small className="justify-self-end text-[8px] font-black tracking-[.4px] text-[#7b574b] uppercase max-[450px]:col-start-2 max-[450px]:justify-self-start">{action}</small>
      <ChevronRight className="w-3.5 text-[#6f5148] transition-transform group-hover:translate-x-0.5 max-[450px]:col-start-3 max-[450px]:row-span-2 max-[450px]:row-start-1" aria-hidden="true" />
    </Link>
  );
}

function resolveSettingsSection(value: string | undefined): SettingsSection | null {
  return value === "hours" || value === "services" || value === "team" || value === "notifications" ? value : null;
}
