import type { Metadata } from "next";
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
import { getStaffSession } from "@/lib/auth";
import {
  formatPhp,
  manilaDate,
} from "@/lib/domain";
import {
  getStaffData,
  type StaffDataScope,
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
import { StaffViewSkeleton } from "./staff-skeletons";
import { SettingsSectionFocus, type SettingsSection } from "./settings-section-focus";
import { TodayAppointments } from "./appointment-list";
import { emptyState, featureView, metricCard, metricGrid, panel, panelHead, settingSection, settingsStack, statusClasses, statusNote, twoPanel } from "./dashboard-styles";
import { resolveStaffView, type StaffView } from "./view-config";

export const metadata: Metadata = { title: "Studio operations" };

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; section?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();
  if (!session) redirect("/login");
  const view = resolveStaffView(params.view, session.role);
  const settingsSection = resolveSettingsSection(params.section);
  const reportPeriod = resolveReportPeriod(params);
  return <Suspense key={view} fallback={<StaffViewSkeleton view={view} label={`Loading ${view}`}/>}><StaffViewData view={view} settingsSection={settingsSection} session={session} reportPeriod={reportPeriod}/></Suspense>;
}

async function StaffViewData({ view, settingsSection, session, reportPeriod }: { view: StaffView; settingsSection: SettingsSection | null; session: NonNullable<Awaited<ReturnType<typeof getStaffSession>>>; reportPeriod: ReportPeriod }) {
  await connection();
  const data = await getStaffData(view as StaffDataScope, view === "reports" ? reportPeriod : undefined);
  return data.error ? <StateCard title="Data could not be loaded" detail={data.error}/> : viewContent(view, settingsSection, data, session, reportPeriod);
}

function viewContent(
  view: StaffView,
  settingsSection: SettingsSection | null,
  data: Awaited<ReturnType<typeof getStaffData>>,
  session: { role: string; userId: string },
  reportPeriod: ReportPeriod,
) {
  const role = session.role;
  if (view === "overview") return <Overview data={data} role={role} />;
  if (view === "calendar")
    return <CalendarWorkspace role={role} userId={session.userId} services={data.services} staff={data.staff} assignments={data.serviceAssignments} stations={data.stations} />;
  if (view === "clients") return <Clients data={data} role={role} />;
  if (view === "sales") return <Sales data={data} />;
  if (view === "reports") return <Reports data={data} period={reportPeriod} />;
  return <StudioSettings data={data} role={role} section={settingsSection} />;
}

function Overview({
  data,
  role,
}: {
  data: Awaited<ReturnType<typeof getStaffData>>;
  role: string;
}) {
  const today = manilaDate(new Date());
  const appointments = data.bookings.filter(
    (item) => manilaDate(item.startsAt) === today,
  );
  const completedSales = data.sales.filter(
    (item) =>
      item.status === "completed" && manilaDate(item.createdAt) === today,
  );
  const revenue = completedSales.reduce(
    (sum, item) => sum + item.totalCents - item.adjustmentCents,
    0,
  );
  const pendingEmails = data.deliveries.filter(
    (item) => item.status === "pending" || item.status === "failed",
  ).length;
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
    <div className={featureView}>
      <div className={metricGrid}>
        <Metric
          icon={<CalendarDays />}
          label="Appointments"
          value={String(appointments.length)}
          note="Today in Manila"
        />
        <Metric
          icon={<Clock3 />}
          label="Confirmed"
          value={String(
            appointments.filter((item) => item.status === "confirmed").length,
          )}
          note="Ready for the studio"
        />
        <Metric
          icon={<UsersRound />}
          label="Clients"
          value={String(data.customerCount)}
          note="Stored records"
        />
        {role !== "piercer" && (
          <Metric
            icon={<CircleDollarSign />}
            label="Collected"
            value={formatPhp(revenue)}
            note={`${completedSales.length} completed sales`}
          />
        )}
      </div>
      <div className={`${twoPanel} items-start`}>
        <TodayAppointments bookings={appointments} role={role} />
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
                done={pendingEmails === 0}
                detail={
                  pendingEmails
                    ? `${pendingEmails} need attention`
                    : "All clear"
                }
                section="notifications"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Clients({
  data,
  role,
}: {
  data: Awaited<ReturnType<typeof getStaffData>>;
  role: string;
}) {
  return (
    <div className={featureView}>
      <ClientRecords
        customers={data.customers}
        canCreate={role === "owner" || role === "manager"}
      />
    </div>
  );
}

function Sales({ data }: { data: Awaited<ReturnType<typeof getStaffData>> }) {
  return <SalesView initialSales={data.sales} services={data.services} />;
}

const reportPresets: Array<{ value: ReportPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

function Reports({ data, period }: { data: Awaited<ReturnType<typeof getStaffData>>; period: ReportPeriod }) {
  const presetLinks = reportPresets.map((item) => {
    const resolved = resolveReportPeriod({ period: item.value });
    return {
      ...item,
      href: item.value === "custom"
        ? `/app?view=reports&period=custom&from=${period.from}&to=${period.to}`
        : `/app?view=reports&period=${item.value}&from=${resolved.from}&to=${resolved.to}`,
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
  data,
  role,
  section,
}: {
  data: Awaited<ReturnType<typeof getStaffData>>;
  role: string;
  section: SettingsSection | null;
}) {
  return (
    <div className={featureView}>
      <SettingsSectionFocus section={section} />
      <div className={settingsStack}>
        <SettingsForm studio={data.studio} />
        <ScheduleSettings studio={data.studio} staff={data.staff} availability={data.availability} closures={data.closures} sectionId="studio-settings-hours" />
        <section id="studio-settings-services" className={settingSection} tabIndex={-1}>
          <PanelHead
            title="Services & pricing"
            detail="Only active, assigned services appear on public booking."
          />
          <ServiceForm staff={data.staff} />
          <div id="studio-settings-assignments" tabIndex={-1}>
            <ServiceAssignmentForm
              services={data.services}
              staff={data.staff}
              assignments={data.serviceAssignments}
            />
          </div>
          <ServiceList services={data.services} />
        </section>
        <section id="studio-settings-team" className={settingSection} tabIndex={-1}>
          <PanelHead
            title="Team, schedules & stations"
            detail="Owners manage invitations; managers configure operational availability."
          />
          {role === "owner" && <InviteForm />}
          <StationForm />
          <div className="mt-3 [&>div]:flex [&>div]:min-h-[54px] [&>div]:items-center [&>div]:justify-between [&>div]:border-t [&>div]:border-dashed [&>div]:border-[#d6a786] [&>div]:px-[18px] [&>div]:py-2 [&>div>span]:flex [&>div>span]:flex-col [&>div>span]:gap-[3px] [&_strong]:text-[10px] [&_small]:text-[8px] [&_small]:text-studio-muted">
            {data.staff.map((person) => (
              <div key={person.id}>
                <span>
                  <strong>{person.displayName}</strong>
                  <small>
                    {person.role} · {person.active ? "Active" : "Inactive"}
                  </small>
                </span>
                <StaffActions
                  person={person}
                  currentRole={role as "owner" | "manager" | "piercer"}
                />
                <i className="size-2 shrink-0 rounded-full" style={{ background: person.color }} />
              </div>
            ))}
            {data.stations.map((station) => (
              <div key={station.id}>
                <span>
                  <strong>{station.name}</strong>
                  <small>Active station</small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className={twoPanel}>
          <div className={settingSection}>
            <PanelHead
              title="Consent records"
              detail="Signed acknowledgements are stored against bookings."
            />
            <p className={`${statusNote} mx-[18px] my-2.5`}>
              Consent records become visible from the associated client and
              appointment once submitted.
            </p>
          </div>
          <div id="studio-settings-notifications" className={settingSection} tabIndex={-1}>
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
          </div>
        </section>
      </div>
    </div>
  );
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
      href={`/app?view=settings&section=${section}`}
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
