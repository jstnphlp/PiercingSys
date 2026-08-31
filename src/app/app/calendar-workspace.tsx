"use client";

import { Check, ChevronLeft, ChevronRight, Clock3, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { combinedServiceDuration, manilaDate, shiftManilaDate, type BookingStatus, type Service } from "@/lib/domain";
import type { CustomerRecord, StaffRecord } from "@/lib/data/staff";
import { layoutOverlappingAppointments } from "./calendar-layout";
import { CalendarGridSkeleton } from "./staff-skeletons";

type Station = { id: string; name: string };
type RawAppointment = {
  id: string; reference: string; status: BookingStatus; starts_at: string; ends_at: string; notes: string | null;
  assigned_piercer_id: string; station_id: string | null;
  customers: { id: string; first_name: string; last_name: string; email: string; phone: string } | Array<{ id: string; first_name: string; last_name: string; email: string; phone: string }>;
  booking_services: Array<{ id: string; service_id: string; position: number; name: string; duration_minutes: number }>;
  staff_profiles: { user_id: string; display_name: string; color: string } | Array<{ user_id: string; display_name: string; color: string }> | null;
  stations: Station | Station[] | null;
  sales: { id: string; status: string } | Array<{ id: string; status: string }> | null;
};

type Props = {
  role: string;
  userId: string;
  services: Service[];
  staff: StaffRecord[];
  assignments: Array<{ serviceId: string; staffId: string }>;
  stations: Station[];
  customers: CustomerRecord[];
};

const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const gridStartHour = 8;
const gridEndHour = 21;
const hourHeight = 60;

export function CalendarWorkspace(props: Props) {
  const [mode, setMode] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState(() => manilaDate(new Date()));
  const [piercerId, setPiercerId] = useState(props.role === "piercer" ? props.userId : "");
  const [stationId, setStationId] = useState("");
  const [appointments, setAppointments] = useState<RawAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<RawAppointment | null>(null);
  const [now, setNow] = useState(() => new Date());
  const days = useMemo(() => mode === "week" ? weekDates(anchor) : [anchor], [anchor, mode]);
  const visibleAppointments = useMemo(() => appointments.filter(isVisibleAppointment), [appointments]);

  async function load() {
    setLoading(true); setError("");
    const query = new URLSearchParams({ from: days[0], to: days.at(-1)! });
    if (piercerId) query.set("piercerId", piercerId);
    if (stationId) query.set("stationId", stationId);
    try {
      const response = await fetch(`/api/appointments?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Calendar could not be loaded.");
      setAppointments(body.data ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Calendar could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [anchor, mode, piercerId, stationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="feature-view calendar-workspace">
    <div className="calendar-toolbar" aria-label="Calendar controls">
      <button className="btn btn-secondary icon-button" aria-label={`Previous ${mode}`} onClick={() => setAnchor(shiftManilaDate(anchor, mode === "week" ? -7 : -1))}><ChevronLeft/></button>
      <button className="btn btn-secondary" onClick={() => setAnchor(manilaDate(new Date()))}>Today</button>
      <button className="btn btn-secondary icon-button" aria-label={`Next ${mode}`} onClick={() => setAnchor(shiftManilaDate(anchor, mode === "week" ? 7 : 1))}><ChevronRight/></button>
      <select aria-label="Filter by piercer" value={piercerId} disabled={props.role === "piercer"} onChange={(event) => setPiercerId(event.target.value)}>
        <option value="">All piercers</option>{props.staff.filter(isPiercer).map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
      </select>
      <select aria-label="Filter by station" value={stationId} onChange={(event) => setStationId(event.target.value)}>
        <option value="">All stations</option>{props.stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
      </select>
      <div className="calendar-toggle" aria-label="Calendar view">
        <button className={mode === "week" ? "active" : ""} aria-pressed={mode === "week"} onClick={() => setMode("week")}>Week</button>
        <button className={mode === "day" ? "active" : ""} aria-pressed={mode === "day"} onClick={() => setMode("day")}>Day</button>
      </div>
      <button className="btn btn-primary calendar-create-button" onClick={() => setNewOpen(true)}><Plus size={16}/> New appointment</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="panel operation-calendar" aria-busy={loading}>
      {loading ? <><span className="sr-only" role="status">Loading live appointments</span><div className="calendar-scroll"><CalendarGridSkeleton day={mode === "day"}/></div></>
        : mode === "week" ? <WeekCalendar days={days} anchor={anchor} appointments={visibleAppointments} now={now} onSelectDate={(date) => { setAnchor(date); setMode("day"); }} onSelectAppointment={setSelected}/>
          : <DayCalendar date={anchor} appointments={visibleAppointments} onSelectAppointment={setSelected}/>}
    </section>
    {newOpen && <AppointmentFormDialog {...props} initialDate={anchor} onClose={() => setNewOpen(false)} onSaved={async () => { setNewOpen(false); await load(); }}/>} 
    {selected && <AppointmentDialog appointment={selected} {...props} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await load(); }}/>} 
  </div>;
}

function WeekCalendar({ days, anchor, appointments, now, onSelectDate, onSelectAppointment }: {
  days: string[];
  anchor: string;
  appointments: RawAppointment[];
  now: Date;
  onSelectDate: (date: string) => void;
  onSelectAppointment: (appointment: RawAppointment) => void;
}) {
  const today = manilaDate(now);
  const currentMinutes = manilaMinutes(now.toISOString());
  const showNow = days.includes(today) && currentMinutes >= gridStartHour * 60 && currentMinutes <= gridEndHour * 60;
  return <div className="calendar-scroll week">
    <div className="calendar-grid" style={{ "--calendar-days": days.length } as React.CSSProperties}>
      <div className="calendar-corner"><Clock3/><span>GMT+8</span></div>
      {days.map((date) => <button type="button" className={`calendar-date ${date === today ? "today" : ""} ${date === anchor ? "selected" : ""}`} key={date} onClick={() => onSelectDate(date)} aria-label={`Open day view for ${formatLongDate(date)}`}>
        <span>{dayNames[weekday(date)]}</span><strong>{date.slice(8)}</strong><small>{formatMonth(date)}</small>
      </button>)}
      <div className="calendar-times">{Array.from({ length: gridEndHour - gridStartHour + 1 }, (_, index) => <span key={index} style={{ top: index * hourHeight }}>{formatHour(gridStartHour + index)}</span>)}</div>
      {days.map((date) => {
        const positionedAppointments = layoutOverlappingAppointments(appointments.filter((item) => manilaDate(item.starts_at) === date));
        return <div className={`calendar-column ${date === today ? "today" : ""} ${date === anchor ? "selected" : ""}`} key={date}>
        {positionedAppointments.map(({ item, lane, laneCount }) => {
          const start = manilaMinutes(item.starts_at); const end = manilaMinutes(item.ends_at); const piercer = one(item.staff_profiles); const station = one(item.stations);
          const accessibleLabel = `${formatTime(item.starts_at)} to ${formatTime(item.ends_at)}, ${clientName(item)}, ${servicesLabel(item)}, ${piercer?.display_name ?? "Unassigned"}, ${station?.name ?? "No station"}`;
          return <button type="button" key={item.id} className={`calendar-event ${item.status}`} style={{
            top: Math.max(0, (start - gridStartHour * 60) * hourHeight / 60),
            height: Math.max(34, (end - start) * hourHeight / 60),
            "--event-color": piercer?.color ?? "#e86f2c",
            "--event-lane": lane,
            "--event-lanes": laneCount,
          } as React.CSSProperties} onClick={() => onSelectAppointment(item)} aria-label={accessibleLabel} title={accessibleLabel}>
            <strong>{formatTime(item.starts_at)} · {clientName(item)}</strong>
            <small>{piercer?.display_name ?? "Unassigned"} · {station?.name ?? "No station"}</small>
            <i>{servicesLabel(item)}</i>
          </button>;
        })}
      </div>;})}
      {showNow && <div className="calendar-now-line" style={{ top: 64 + (currentMinutes - gridStartHour * 60) * hourHeight / 60 }} aria-hidden="true"><span/></div>}
    </div>
  </div>;
}

function DayCalendar({ date, appointments, onSelectAppointment }: { date: string; appointments: RawAppointment[]; onSelectAppointment: (appointment: RawAppointment) => void }) {
  const items = appointments.filter((item) => manilaDate(item.starts_at) === date).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return <div className="day-calendar">
    <aside className={`day-date-block ${date === manilaDate(new Date()) ? "today" : ""}`}>
      <span>{dayNames[weekday(date)]}</span><strong>{date.slice(8)}</strong><small>{formatMonth(date)}</small>
    </aside>
    <div className="day-calendar-content">
      <header className="day-list-heading"><div><h3>{formatLongDate(date)}</h3><p>Daily appointment list · Asia/Manila</p></div><span>{items.length} appointment{items.length === 1 ? "" : "s"}</span></header>
      {items.length ? <div className="day-appointment-list">{items.map((item) => {
        const piercer = one(item.staff_profiles); const station = one(item.stations);
        return <button type="button" className="day-appointment-row" key={item.id} onClick={() => onSelectAppointment(item)} style={{ "--event-color": piercer?.color ?? "#e86f2c" } as React.CSSProperties}>
          <span className="day-appointment-time"><strong>{formatTime(item.starts_at)}</strong><small>{formatTime(item.ends_at)}</small></span>
          <span className="client-avatar">{initials(clientName(item))}</span>
          <span className="day-appointment-client"><strong>{clientName(item)}</strong><small>{servicesLabel(item)} · {item.reference}</small></span>
          <span className="day-appointment-piercer"><i/><span>{piercer?.display_name ?? "Unassigned"}<small>{station?.name ?? "No station"}</small></span></span>
          <span className={`status-pill ${item.status}`}>{item.status.replace("_", " ")}</span>
          <ChevronRight className="day-row-chevron" aria-hidden="true"/>
        </button>;
      })}</div> : <div className="day-calendar-empty"><Clock3/><h3>No appointments this day</h3><p>The selected date is clear for the current filters.</p></div>}
    </div>
  </div>;
}

function AppointmentFormDialog(props: Props & { initialDate: string; onClose: () => void; onSaved: () => void }) {
  const activeServices = props.services.filter((service) => service.isActive);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [piercerId, setPiercerId] = useState(props.role === "piercer" ? props.userId : "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const selectedServices = activeServices.filter((service) => serviceIds.includes(service.id));
  const duration = combinedServiceDuration(selectedServices);
  const eligible = props.staff.filter((person) => isPiercer(person) && person.active &&
    serviceIds.every((serviceId) => props.assignments.some((item) => item.serviceId === serviceId && item.staffId === person.id)));
  const effectivePiercerId = eligible.some((person) => person.id === piercerId)
    ? piercerId : props.role === "piercer" ? props.userId : "";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const payload = {
      serviceIds, startsAt: `${form.get("date")}T${form.get("time")}:00+08:00`, piercerId: effectivePiercerId,
      stationId: form.get("stationId") || null, customerId: clientMode === "existing" ? form.get("customerId") : null,
      customer: clientMode === "new" ? { firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), phone: form.get("phone") } : null,
      notes: form.get("notes") || null, sendConfirmation: form.get("sendConfirmation") === "on",
    };
    const response = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error?.message ?? "Appointment could not be created."); return; }
    props.onSaved();
  }
  return <Dialog title="New appointment" detail="Studio-created bookings ignore public lead time and horizon limits." onClose={props.onClose}>
    <form className="operation-form" onSubmit={submit}>
      <fieldset className="service-picker"><legend>Services</legend>{activeServices.map((service) => <label key={service.id}>
        <input type="checkbox" checked={serviceIds.includes(service.id)} onChange={(event) => setServiceIds((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))}/>
        <span><strong>{service.name}</strong><small>{service.durationMinutes} min</small></span>
      </label>)}</fieldset>
      <div className="segmented"><button type="button" className={clientMode === "existing" ? "active" : ""} onClick={() => setClientMode("existing")}>Existing client</button><button type="button" className={clientMode === "new" ? "active" : ""} onClick={() => setClientMode("new")}>New client</button></div>
      {clientMode === "existing" ? <label className="field wide">Client<select name="customerId" required><option value="">Choose a client</option>{props.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}</select></label>
        : <div className="form-grid"><label className="field">First name<input name="firstName" required/></label><label className="field">Last name<input name="lastName" required/></label><label className="field">Email<input name="email" type="email" required/></label><label className="field">Phone<input name="phone" required/></label></div>}
      <div className="form-grid"><label className="field">Piercer<select value={effectivePiercerId} onChange={(event) => setPiercerId(event.target.value)} required disabled={props.role === "piercer"}><option value="">Choose eligible piercer</option>{eligible.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <label className="field">Station<select name="stationId"><option value="">No station</option>{props.stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
        <label className="field">Date<input name="date" type="date" defaultValue={props.initialDate} required/></label><label className="field">Manila time<input name="time" type="time" defaultValue="10:00" required/></label></div>
      <p className="duration-note"><Clock3/> Combined duration: <strong>{duration} minutes</strong>. End time is calculated automatically.</p>
      <label className="field wide">Notes<textarea name="notes" maxLength={2000}/></label>
      <label className="check-field compact"><input name="sendConfirmation" type="checkbox" defaultChecked/><span><Check/></span> Email a confirmation to the client</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button type="button" className="btn btn-secondary" onClick={props.onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !serviceIds.length || !effectivePiercerId}>{busy ? "Creating…" : "Create appointment"}</button></footer>
    </form>
  </Dialog>;
}

function AppointmentDialog(props: Props & { appointment: RawAppointment; onClose: () => void; onSaved: () => void }) {
  const item = props.appointment; const [reschedule, setReschedule] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const services = item.booking_services.sort(byPosition); const customer = one(item.customers)!; const piercer = one(item.staff_profiles); const station = one(item.stations); const sale = one(item.sales);
  const eligible = props.staff.filter((person) => isPiercer(person) && person.active && services.every((service) => props.assignments.some((assignment) => assignment.serviceId === service.service_id && assignment.staffId === person.id)));
  async function mutate(payload: Record<string, unknown>) { setBusy(true); setError(""); const response = await fetch(`/api/appointments/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); setBusy(false); if (!response.ok) { setError(body.error?.message ?? "Appointment could not be updated."); return; } props.onSaved(); }
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate({ startsAt: `${form.get("date")}T${form.get("time")}:00+08:00`, piercerId: props.role === "piercer" ? item.assigned_piercer_id : form.get("piercerId"), stationId: form.get("stationId") || null }); }
  return <Dialog title={reschedule ? "Reschedule appointment" : `${customer.first_name} ${customer.last_name}`} detail={`${item.reference} · ${item.status.replace("_", " ")}`} onClose={props.onClose}>
    {reschedule ? <form className="operation-form" onSubmit={submit}>
      <p className="modal-callout">The combined {services.reduce((sum, service) => sum + service.duration_minutes, 0)}-minute duration, studio hours, closures, qualifications, availability, and overlaps will be checked.</p>
      <div className="form-grid"><label className="field">Date<input name="date" type="date" defaultValue={manilaDate(item.starts_at)} required/></label><label className="field">Manila time<input name="time" type="time" defaultValue={manilaTimeValue(item.starts_at)} required/></label>
        <label className="field">Piercer<select name="piercerId" defaultValue={item.assigned_piercer_id} disabled={props.role === "piercer"}>{eligible.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label><label className="field">Station<select name="stationId" defaultValue={item.station_id ?? ""}><option value="">No station</option>{props.stations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}<footer><button type="button" className="btn btn-secondary" onClick={() => { setReschedule(false); setError(""); }}>Back</button><button className="btn btn-primary" disabled={busy}>{busy ? "Checking…" : "Save new schedule"}</button></footer>
    </form> : <div className="appointment-detail">
      <div className="detail-services">{services.map((service) => <span key={service.id}>{service.name}<small>{service.duration_minutes} minutes</small></span>)}</div>
      <dl><div><dt>When</dt><dd>{formatLongDate(manilaDate(item.starts_at))}<br/>{formatTime(item.starts_at)}–{formatTime(item.ends_at)}</dd></div><div><dt>Piercer</dt><dd>{piercer?.display_name ?? "Unassigned"}</dd></div><div><dt>Station</dt><dd>{station?.name ?? "No station"}</dd></div><div><dt>Linked sale</dt><dd>{sale?.status ?? "Not created"}</dd></div><div><dt>Contact</dt><dd>{customer.email}<br/>{customer.phone}</dd></div><div><dt>Notes</dt><dd>{item.notes || "No notes"}</dd></div></dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button className="btn btn-secondary" onClick={() => setReschedule(true)}>Reschedule</button>{item.status === "confirmed" && <><button className="btn btn-secondary" disabled={busy} onClick={() => void mutate({ status: "no_show" })}>No-show</button><button className="btn btn-primary" disabled={busy} onClick={() => void mutate({ status: "completed" })}>Complete & create sale</button><button className="btn danger" disabled={busy} onClick={() => void mutate({ status: "cancelled" })}>Cancel</button></>}</footer>
    </div>}
  </Dialog>;
}

export function Dialog({ title, detail, onClose, children }: { title: string; detail: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialog) { const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href]')]; if (!focusable.length) return; const first = focusable[0], last = focusable.at(-1)!; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", keydown); return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="operation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="operation-dialog" role="dialog" aria-modal="true" aria-labelledby="operation-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="operation-dialog-title">{title}</h2><p>{detail}</p></div><button aria-label="Close dialog" onClick={onClose}><X/></button></header>{children}
  </div></div>;
}

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function byPosition(a: { position: number }, b: { position: number }) { return a.position - b.position; }
function isPiercer(person: StaffRecord) { return person.role === "piercer" && person.active; }
function isVisibleAppointment(item: RawAppointment) { return !["cancelled", "rejected"].includes(item.status); }
function clientName(item: RawAppointment) { const customer = one(item.customers); return customer ? `${customer.first_name} ${customer.last_name}` : "Client"; }
function servicesLabel(item: RawAppointment) { return [...item.booking_services].sort(byPosition).map((service) => service.name).join(" + ") || "No services"; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PC"; }
function weekday(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
function shiftDate(date: string, days: number) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function weekDates(anchor: string) { const start = shiftDate(anchor, -weekday(anchor)); return Array.from({ length: 7 }, (_, index) => shiftDate(start, index)); }
function formatMonth(date: string) { return new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatLongDate(date: string) { return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatHour(hour: number) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, hour))); }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function manilaTimeValue(value: string) { const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).formatToParts(new Date(value)); return `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`; }
function manilaMinutes(value: string) { const [hour, minute] = manilaTimeValue(value).split(":").map(Number); return hour * 60 + minute; }
