import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Download,
  ExternalLink,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { getStaffSession } from "@/lib/auth";
import {
  calculateBalance,
  formatPhp,
  formatServicePrice,
  manilaDate,
} from "@/lib/domain";
import { getStaffData, type BookingRecord } from "@/lib/data/staff";
import {
  AvailabilityForm,
  BookingActions,
  ClosureForm,
  InviteForm,
  SaleAdjustment,
  SaleForm,
  ServiceAssignmentForm,
  ServiceForm,
  SettingsForm,
  StaffActions,
  StationForm,
} from "./controls";
import "./dashboard.css";
import "./dashboard-maximalist.css";

export const metadata: Metadata = { title: "Studio operations" };
type View =
  | "overview"
  | "calendar"
  | "clients"
  | "sales"
  | "reports"
  | "settings";
const managementViews: View[] = [
  "overview",
  "calendar",
  "clients",
  "sales",
  "reports",
  "settings",
];
const piercerViews: View[] = ["overview", "calendar", "clients"];

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await connection();
  const session = await getStaffSession();
  if (!session) redirect("/login");
  const allowed = session.role === "piercer" ? piercerViews : managementViews;
  const requested = (await searchParams).view as View | undefined;
  const view =
    requested && allowed.includes(requested) ? requested : "overview";
  const data = await getStaffData();
  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <Link href="/app" className="staff-brand">
          <Image src="/logo.png" alt="" width={48} height={48} priority />
          <span>
            <strong>Piercing Corner</strong>
            <small>STUDIO DESK</small>
          </span>
        </Link>
        <p className="nav-label">Workspace</p>
        <nav>
          {allowed.map((item) => (
            <Link
              key={item}
              href={item === "overview" ? "/app" : `/app?view=${item}`}
              className={view === item ? "active" : ""}
            >
              {navIcon(item)}
              <span>{item[0].toUpperCase() + item.slice(1)}</span>
            </Link>
          ))}
        </nav>
        <div className="staff-account">
          <span className="avatar">{initials(session.displayName)}</span>
          <span>
            <strong>{session.displayName}</strong>
            <small>{session.role}</small>
          </span>
          <form action={signOut}>
            <button>Sign out</button>
          </form>
        </div>
      </aside>
      <main className="staff-main">
        <header className="staff-topbar">
          <div>
            <p className="eyebrow">
              PIERCING CORNER · {session.role.toUpperCase()}
            </p>
            <h1>
              {view === "overview"
                ? "Today at the corner"
                : view[0].toUpperCase() + view.slice(1)}
            </h1>
          </div>
          <div className="top-actions">
            <Link href="/book" target="_blank" className="btn btn-secondary">
              <ExternalLink size={15} /> Public booking
            </Link>
          </div>
        </header>
        <div className="staff-content">
          <div className="dashboard-content">
            {data.error ? (
              <StateCard title="Data could not be loaded" detail={data.error} />
            ) : (
              viewContent(view, data, session.role)
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function viewContent(
  view: View,
  data: Awaited<ReturnType<typeof getStaffData>>,
  role: string,
) {
  if (view === "overview") return <Overview data={data} role={role} />;
  if (view === "calendar")
    return <Calendar bookings={data.bookings} role={role} />;
  if (view === "clients") return <Clients data={data} />;
  if (view === "sales") return <Sales data={data} />;
  if (view === "reports") return <Reports data={data} />;
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
      <PageIntro
        title="Daily overview"
        detail={new Intl.DateTimeFormat("en-PH", {
          dateStyle: "full",
          timeZone: "Asia/Manila",
        }).format(new Date())}
      />
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
          value={String(data.customers.length)}
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
      <div className="two-panel">
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

function Calendar({
  bookings,
  role,
}: {
  bookings: BookingRecord[];
  role: string;
}) {
  const upcoming = bookings
    .filter((item) => new Date(item.endsAt) >= new Date())
    .slice(0, 100);
  const groups = upcoming.reduce((map, item) => {
    const key = manilaDate(item.startsAt);
    map.set(key, [...(map.get(key) ?? []), item]);
    return map;
  }, new Map<string, BookingRecord[]>());
  return (
    <div className="feature-view">
      <PageIntro
        title="Studio calendar"
        detail="Confirmed appointments use Asia/Manila time. Piercer and station overlaps are blocked by the database."
      />
      {upcoming.length ? (
        <div className="calendar-days">
          {[...groups].map(([date, items]) => (
            <section className="panel calendar-day" key={date}>
              <div className="date-block">
                <small>
                  {new Intl.DateTimeFormat("en-PH", {
                    weekday: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(items[0].startsAt))}
                </small>
                <strong>
                  {new Intl.DateTimeFormat("en-PH", {
                    day: "2-digit",
                    timeZone: "Asia/Manila",
                  }).format(new Date(items[0].startsAt))}
                </strong>
                <span>
                  {new Intl.DateTimeFormat("en-PH", {
                    month: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(items[0].startsAt))}
                </span>
              </div>
              <AppointmentList bookings={items} role={role} />
            </section>
          ))}
        </div>
      ) : (
        <StateCard
          title="The calendar is clear"
          detail="New confirmed public bookings will appear here immediately."
        />
      )}
    </div>
  );
}

function Clients({ data }: { data: Awaited<ReturnType<typeof getStaffData>> }) {
  return (
    <div className="feature-view">
      <PageIntro
        title="Client records"
        detail="Contact details and appointment history visible under your role permissions."
      />
      {data.customers.length ? (
        <section className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Appointments</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((customer) => {
                const bookings = data.bookings.filter(
                  (item) => item.customer.id === customer.id,
                );
                return (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name}</strong>
                    </td>
                    <td>
                      <span>{customer.email}</span>
                      <small>{customer.phone}</small>
                    </td>
                    <td>{bookings.length}</td>
                    <td>
                      {bookings[0]
                        ? formatDate(bookings[0].startsAt)
                        : formatDate(customer.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <StateCard
          title="No clients yet"
          detail="A client record is created automatically with their first confirmed booking."
        />
      )}
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
      <PageIntro
        title="Sales & payments"
        detail="Record deposits and full payments in centavo-based PHP values."
      />
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

function Reports({ data }: { data: Awaited<ReturnType<typeof getStaffData>> }) {
  const completed = data.sales.filter((item) => item.status === "completed");
  const revenue = completed.reduce(
    (sum, item) => sum + item.totalCents - item.adjustmentCents,
    0,
  );
  const completeBookings = data.bookings.filter(
    (item) => item.status === "completed",
  ).length;
  const methodTotals = new Map<string, number>();
  data.sales.forEach((sale) =>
    sale.methods.forEach((method) =>
      methodTotals.set(
        method,
        (methodTotals.get(method) ?? 0) +
          sale.paidCents / Math.max(1, sale.methods.length),
      ),
    ),
  );
  const today = manilaDate(new Date());
  const first = `${today.slice(0, 8)}01`;
  return (
    <div className="feature-view">
      <PageIntro
        title="Operational reports"
        detail="Stored sales and appointment outcomes, grouped on Manila business dates."
        action={
          <a
            className="btn btn-secondary"
            href={`/api/reports/export?from=${first}&to=${today}`}
          >
            <Download size={16} /> Export CSV
          </a>
        }
      />
      <div className="metric-grid compact">
        <Metric
          icon={<CircleDollarSign />}
          label="Revenue"
          value={formatPhp(revenue)}
          note="Completed sales"
        />
        <Metric
          icon={<ShoppingBag />}
          label="Transactions"
          value={String(completed.length)}
          note="Completed"
        />
        <Metric
          icon={<CalendarDays />}
          label="Procedures"
          value={String(completeBookings)}
          note={`${data.bookings.filter((item) => item.status === "no_show").length} no-shows`}
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
            detail="Current stored records"
          />
          <div className="report-list">
            {["confirmed", "completed", "cancelled", "no_show", "rejected"].map(
              (status) => (
                <div key={status}>
                  <span>{status.replace("_", " ")}</span>
                  <strong>
                    {
                      data.bookings.filter((item) => item.status === status)
                        .length
                    }
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
      <PageIntro
        title="Studio settings"
        detail="Piercing Corner is a single-studio system; there is no workspace or studio switcher."
      />
      <div className="settings-stack">
        <SettingsForm studio={data.studio} />
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
          <AvailabilityForm staff={data.staff} />
          <ClosureForm />
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
            {data.closures.map((closure) => (
              <div key={closure.id}>
                <span>
                  <strong>Closure · {formatDate(closure.startsAt)}</strong>
                  <small>
                    {formatTime(closure.startsAt)}–{formatTime(closure.endsAt)}{" "}
                    · {closure.reason || "No reason supplied"}
                  </small>
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
              {item.service.name} · {item.reference}
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
function PageIntro({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {action}
    </div>
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
function navIcon(view: View) {
  const Icon =
    view === "overview"
      ? LayoutDashboard
      : view === "calendar"
        ? CalendarDays
        : view === "clients"
          ? UsersRound
          : view === "sales"
            ? ShoppingBag
            : view === "reports"
              ? BarChart3
              : Settings;
  return <Icon />;
}
