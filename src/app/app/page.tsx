import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  CalendarDays,
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
  type BookingRecord,
  type StaffDataScope,
} from "@/lib/data/staff";
import { resolveReportPeriod, type ReportPeriod, type ReportPreset } from "@/lib/report-period";
import {
  BookingActions,
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
import { emptyState, featureView, metricCard, metricGrid, panel, panelHead, settingSection, settingsStack, statusClasses, statusNote, twoPanel } from "./dashboard-styles";
import { resolveStaffView, type StaffView } from "./view-config";

export const metadata: Metadata = { title: "Studio operations" };

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();
  if (!session) redirect("/login");
  const view = resolveStaffView(params.view, session.role);
  const reportPeriod = resolveReportPeriod(params);
  return <Suspense key={view} fallback={<StaffViewSkeleton view={view} label={`Loading ${view}`}/>}><StaffViewData view={view} session={session} reportPeriod={reportPeriod}/></Suspense>;
}

async function StaffViewData({ view, session, reportPeriod }: { view: StaffView; session: NonNullable<Awaited<ReturnType<typeof getStaffSession>>>; reportPeriod: ReportPeriod }) {
  await connection();
  const data = await getStaffData(view as StaffDataScope, view === "reports" ? reportPeriod : undefined);
  return data.error ? <StateCard title="Data could not be loaded" detail={data.error}/> : viewContent(view, data, session, reportPeriod);
}

function viewContent(
  view: StaffView,
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
  return <StudioSettings data={data} role={role} />;
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
        <section className={panel}>
          <PanelHead
            title="Today’s appointments"
            detail="Live records from the studio calendar"
          />
          {appointments.length ? (
            <AppointmentList bookings={appointments} role={role} />
          ) : (
            <Empty
              icon={<CalendarDays />}
              title="No appointments today"
              text="Confirmed online bookings and staff appointments will appear here."
            />
          )}
        </section>
        <section className={panel}>
          <PanelHead
            title="Studio readiness"
            detail="Items affecting daily operations"
          />
          <div className="flex flex-col [&>div]:grid [&>div]:min-h-[61px] [&>div]:grid-cols-[26px_1fr] [&>div]:items-center [&>div]:gap-x-[9px] [&>div]:border-b [&>div]:border-dashed [&>div]:border-[#d5a684] [&>div]:px-[17px] [&>div]:py-2.5 [&>div>span]:row-span-2 [&>div>span]:grid [&>div>span]:size-6 [&>div>span]:place-items-center [&>div>span]:rounded-full [&>div>span]:border [&>div>span]:border-hippy-ink [&>div>span]:text-[10px] [&>div>span]:font-black [&>div>span]:shadow-[1px_1px_0_#3b2923] [&_strong]:text-[10px] [&_small]:text-[8px] [&_small]:text-studio-muted">
            <Readiness
              label="Business hours"
              done={Object.keys(data.studio.businessHours).length > 0}
            />
            <Readiness
              label="Active services"
              done={data.services.some((item) => item.isActive)}
            />
            <Readiness
              label="Qualified staff"
              done={data.serviceAssignments.some((assignment) =>
                data.staff.some(
                  (person) =>
                    person.id === assignment.staffId &&
                    person.active &&
                    person.role === "piercer",
                ),
              )}
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
}: {
  data: Awaited<ReturnType<typeof getStaffData>>;
  role: string;
}) {
  return (
    <div className={featureView}>
      <div className={settingsStack}>
        <SettingsForm studio={data.studio} />
        <ScheduleSettings studio={data.studio} staff={data.staff} availability={data.availability} closures={data.closures} />
        <section className={settingSection}>
          <PanelHead
            title="Services & pricing"
            detail="Only active, assigned services appear on public booking."
          />
          <ServiceForm staff={data.staff} />
          <ServiceAssignmentForm
            services={data.services}
            staff={data.staff}
            assignments={data.serviceAssignments}
          />
          <ServiceList services={data.services} />
        </section>
        <section className={settingSection}>
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
          <div className={settingSection}>
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

function AppointmentList({
  bookings,
  role,
}: {
  bookings: BookingRecord[];
  role: string;
}) {
  return (
    <div>
      {bookings.map((item) => (
        <article className="grid min-h-[72px] grid-cols-[64px_34px_minmax(150px,1fr)_minmax(130px,.65fr)_82px_auto] items-center gap-2.5 border-b border-dashed border-[#dab08f] bg-transparent px-4 py-[9px] hover:bg-[#fff1cf] last:border-0 max-[1100px]:grid-cols-[60px_32px_1fr_80px_auto] max-[760px]:grid-cols-[52px_30px_1fr_auto] max-[760px]:px-2.5" key={item.id}>
          <div className="flex flex-col [&_strong]:text-[10px] [&_strong]:text-hippy-ink [&_small]:mt-[3px] [&_small]:text-[8px] [&_small]:text-[#80675e]">
            <strong>{formatTime(item.startsAt)}</strong>
            <small>{formatTime(item.endsAt)}</small>
          </div>
          <span className="grid size-[33px] place-items-center rounded-[50%_42%_50%_45%] border border-hippy-ink bg-[#e98956] text-[10px] font-extrabold text-[#522b1b]">{initials(item.customer.name)}</span>
          <div className="flex flex-col [&_strong]:text-[10px] [&_strong]:text-hippy-ink [&_small]:mt-[3px] [&_small]:text-[8px] [&_small]:text-[#80675e]">
            <strong>{item.customer.name}</strong>
            <small>
              {item.services.map((service) => service.name).join(" + ")} · {item.reference}
            </small>
          </div>
          <div className="flex items-center gap-[7px] text-[9px] max-[1100px]:hidden [&>i]:size-2 [&>i]:shrink-0 [&>i]:rounded-full [&>span]:flex [&>span]:flex-col [&_small]:mt-[3px] [&_small]:text-[8px] [&_small]:text-[#80675e]">
            {item.piercer && <i style={{ background: item.piercer.color }} />}
            <span>
              {item.piercer?.name ?? "Unassigned"}
              <small>{item.station ?? "No station"}</small>
            </span>
          </div>
          <Status value={item.status} />
          {["confirmed", "requested"].includes(item.status) && (
            <BookingActions
              id={item.id}
              status={item.status}
              canManage={role !== "piercer"}
              startsAt={item.startsAt}
            />
          )}
        </article>
      ))}
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
function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={emptyState}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
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
}: {
  label: string;
  done: boolean;
  detail?: string;
}) {
  return (
    <div>
      <span className={done ? "bg-hippy-sage text-[#274c3c]" : "bg-hippy-gold text-[#664219]"}>{done ? "✓" : "!"}</span>
      <strong>{label}</strong>
      <small>{detail ?? (done ? "Configured" : "Needs setup")}</small>
    </div>
  );
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "PC"
  );
}
