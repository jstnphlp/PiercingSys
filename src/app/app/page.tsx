import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { getStaffSession } from "@/lib/auth";
import {
  calculateBalance,
  formatPhp,
  formatServicePrice,
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
  SaleAdjustment,
  DraftSaleActions,
  SaleForm,
  ServiceAssignmentForm,
  ServiceForm,
  SettingsForm,
  StaffActions,
  StationForm,
} from "./controls";
import { CalendarWorkspace } from "./calendar-workspace";
import { ClientRecords } from "./client-records";
import { ScheduleSettings } from "./schedule-settings";
import { ReportPeriodControls } from "./report-period-controls";
import { StaffViewSkeleton } from "./staff-skeletons";
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
    return <CalendarWorkspace role={role} userId={session.userId} services={data.services} staff={data.staff} assignments={data.serviceAssignments} stations={data.stations} customers={data.customers} />;
  if (view === "clients") return <Clients data={data} />;
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
    <div className="feature-view">
      <div className="metric-grid">
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
      <div className="two-panel overview-panels">
        <section className="panel">
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
        <section className="panel">
          <PanelHead
            title="Studio readiness"
            detail="Items affecting daily operations"
          />
          <div className="readiness-list">
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

function Clients({ data }: { data: Awaited<ReturnType<typeof getStaffData>> }) {
  return (
    <div className="feature-view">
      <ClientRecords customers={data.customers} />
    </div>
  );
}

function Sales({ data }: { data: Awaited<ReturnType<typeof getStaffData>> }) {
  const total = data.sales
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.totalCents - item.adjustmentCents, 0);
  const outstanding = data.sales
    .filter((item) => item.status === "draft")
    .reduce(
      (sum, item) => sum + calculateBalance(item.totalCents, [item.paidCents]),
      0,
    );
  return (
    <div className="feature-view">
      <div className="metric-grid compact">
        <Metric
          icon={<CircleDollarSign />}
          label="Completed revenue"
          value={formatPhp(total)}
          note="All stored sales"
        />
        <Metric
          icon={<ShoppingBag />}
          label="Transactions"
          value={String(data.sales.length)}
          note="Draft and completed"
        />
        <Metric
          icon={<Clock3 />}
          label="Outstanding"
          value={formatPhp(outstanding)}
          note="Balance still due"
        />
      </div>
      <SaleForm customers={data.customers} services={data.services} />
      {data.sales.length ? (
        <section className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Method</th>
                <th>Status</th>
                <th>Items</th>
                <th>Adjustments</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <strong>{sale.reference}</strong>
                    <small>{formatDate(sale.createdAt)}</small>
                  </td>
                  <td>{sale.customerName}</td>
                  <td>{formatPhp(sale.totalCents)}</td>
                  <td>{formatPhp(sale.paidCents)}</td>
                  <td>{sale.methods.join(", ") || "—"}</td>
                  <td>
                    <Status value={sale.status} />
                  </td>
                  <td>{sale.items.map((item) => <small key={item.id}>{item.description} · {item.unitPriceCents === null ? "Pricing required" : formatPhp(item.unitPriceCents)}</small>)}</td>
                  <td>
                    {sale.adjustmentCents > 0 && (
                      <small>{formatPhp(sale.adjustmentCents)} adjusted</small>
                    )}
                    {sale.status === "completed" && (
                      <SaleAdjustment
                        id={sale.id}
                        remainingCents={sale.totalCents - sale.adjustmentCents}
                      />
                    )}
                    {sale.status === "draft" && <DraftSaleActions sale={sale} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <StateCard
          title="No sales recorded"
          detail="Use the form above to record a studio sale or payment."
        />
      )}
    </div>
  );
}

const reportPresets: Array<{ value: ReportPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

function Reports({ data, period }: { data: Awaited<ReturnType<typeof getStaffData>>; period: ReportPeriod }) {
  const revenue = data.completedRevenueCents;
  const completedCount = data.completedSaleCount;
  const completeBookings = data.bookingStatusCounts.completed ?? 0;
  const methodTotals = new Map(Object.entries(data.paymentMethodTotals));
  const presetLinks = reportPresets.map((item) => {
    const resolved = resolveReportPeriod({ period: item.value });
    return {
      ...item,
      href: item.value === "custom"
        ? `/app?view=reports&period=custom&from=${period.from}&to=${period.to}`
        : `/app?view=reports&period=${item.value}&from=${resolved.from}&to=${resolved.to}`,
    };
  });
  return (
    <div className="feature-view">
      <ReportPeriodControls
        key={`${period.preset}-${period.from}-${period.to}`}
        activePreset={period.preset}
        from={period.from}
        to={period.to}
        presets={presetLinks}
      />
      <div className="metric-grid compact">
        <Metric
          icon={<CircleDollarSign />}
          label="Revenue"
          value={formatPhp(revenue)}
          note={`${period.from} to ${period.to}`}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Transactions"
          value={String(completedCount)}
          note="Completed"
        />
        <Metric
          icon={<CalendarDays />}
          label="Procedures"
          value={String(completeBookings)}
          note={`${data.bookingStatusCounts.no_show ?? 0} no-shows`}
        />
      </div>
      <div className="two-panel">
        <section className="panel">
          <PanelHead title="Payment methods" detail="Collected amounts" />
          {methodTotals.size ? (
            <div className="report-list">
              {[...methodTotals].map(([method, amount]) => (
                <div key={method}>
                  <span>{method.replace("_", " ")}</span>
                  <strong>{formatPhp(amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<CircleDollarSign />}
              title="No report data"
              text="Complete a sale to populate this report."
            />
          )}
        </section>
        <section className="panel">
          <PanelHead
            title="Appointment outcomes"
            detail="Selected report period"
          />
          <div className="report-list">
            {["requested", "confirmed", "completed", "cancelled", "no_show", "rejected"].map(
              (status) => (
                <div key={status}>
                  <span>{status.replace("_", " ")}</span>
                  <strong>
                    {data.bookingStatusCounts[status] ?? 0}
                  </strong>
                </div>
              ),
            )}
          </div>
        </section>
      </div>
      <p className="report-note">
        Operational reporting only; this is not a tax invoice or official
        accounting ledger.
      </p>
    </div>
  );
}

function StudioSettings({
  data,
  role,
}: {
  data: Awaited<ReturnType<typeof getStaffData>>;
  role: string;
}) {
  return (
    <div className="feature-view">
      <div className="settings-stack">
        <SettingsForm studio={data.studio} />
        <ScheduleSettings studio={data.studio} staff={data.staff} availability={data.availability} closures={data.closures} />
        <section className="panel setting-section">
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
          <div className="simple-list">
            {data.services.map((service) => (
              <div key={service.id}>
                <span>
                  <strong>{service.name}</strong>
                  <small>
                    {service.category} · {service.durationMinutes} minutes ·{" "}
                    {service.isActive ? "Active" : "Inactive"}
                  </small>
                </span>
                <b>{formatServicePrice(service)}</b>
              </div>
            ))}
            {!data.services.length && (
              <p className="status-note">No services configured.</p>
            )}
          </div>
        </section>
        <section className="panel setting-section">
          <PanelHead
            title="Team, schedules & stations"
            detail="Owners manage invitations; managers configure operational availability."
          />
          {role === "owner" && <InviteForm />}
          <StationForm />
          <div className="simple-list">
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
                <i className="staff-dot" style={{ background: person.color }} />
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
        <section className="two-panel">
          <div className="panel setting-section">
            <PanelHead
              title="Consent records"
              detail="Signed acknowledgements are stored against bookings."
            />
            <p className="status-note">
              Consent records become visible from the associated client and
              appointment once submitted.
            </p>
          </div>
          <div className="panel setting-section">
            <PanelHead
              title="Notification deliveries"
              detail="Confirmation, reschedule, and cancellation email status."
            />
            {data.deliveries.length ? (
              <div className="delivery-list">
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
              <p className="status-note">No email deliveries recorded.</p>
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
    <div className="appointment-list">
      {bookings.map((item) => (
        <article className="appointment-row" key={item.id}>
          <div className="appointment-time">
            <strong>{formatTime(item.startsAt)}</strong>
            <small>{formatTime(item.endsAt)}</small>
          </div>
          <span className="client-avatar">{initials(item.customer.name)}</span>
          <div className="appointment-client">
            <strong>{item.customer.name}</strong>
            <small>
              {item.services.map((service) => service.name).join(" + ")} · {item.reference}
            </small>
          </div>
          <div className="appointment-piercer">
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
    <section className="metric-card">
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
    <div className="panel-head">
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
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function StateCard({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="panel state-card">
      <Sparkles />
      <h2>{title}</h2>
      <p>{detail}</p>
    </section>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status-pill ${value}`}>{value.replace("_", " ")}</span>
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
      <span className={done ? "ready" : "todo"}>{done ? "✓" : "!"}</span>
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
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
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
