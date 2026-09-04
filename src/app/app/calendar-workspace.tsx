"use client";

import { Check, ChevronLeft, ChevronRight, Clock3, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { combinedServiceDuration, manilaDate, manilaDateTime, manilaSchedulingEnd, shiftManilaDate, type Service, type StudioSettings } from "@/lib/domain";
import type { AvailabilityRecord, CalendarAppointmentRecord, StaffRecord } from "@/lib/data/staff";
import { CustomerSelect } from "./customer-select";
import { appointmentDayBoundary } from "./appointment-time";
import { WORKSPACE_REFRESH_EVENT } from "./workspace-refresh";
import { calendarBodyHeight, calendarEndLabel, calendarEventStyle, calendarHeaderHeight, calendarHourLabels, calendarMinuteTop, isCalendarMinuteVisible } from "./calendar-geometry";
import { layoutOverlappingAppointments } from "./calendar-layout";
import { CalendarGridSkeleton, DayListSkeleton } from "./staff-skeletons";
import { cn } from "@/lib/utils";
import { StudioSelect } from "@/components/ui/studio-select";
import { dashButton, dashError, dashField, featureView, operationBackdrop, operationDialog, operationForm, operationGrid, panel, statusClasses } from "./dashboard-styles";

type Station = { id: string; name: string };
type RawAppointment = CalendarAppointmentRecord;

type Props = {
  role: string;
  userId: string;
  services: Service[];
  staff: StaffRecord[];
  assignments: Array<{ serviceId: string; staffId: string }>;
  stations: Station[];
  studio: StudioSettings;
  availability: AvailabilityRecord[];
  initialDate: string;
  initialNow: string;
  initialAppointments: CalendarAppointmentRecord[];
};

const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function CalendarWorkspace(props: Props) {
  const [mode, setMode] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState(props.initialDate);
  const [piercerId, setPiercerId] = useState(props.role === "piercer" ? props.userId : "");
  const [stationId, setStationId] = useState("");
  const [appointments, setAppointments] = useState<RawAppointment[]>(props.initialAppointments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<RawAppointment | null>(null);
  const [now, setNow] = useState(() => new Date(props.initialNow));
  const days = useMemo(() => mode === "week" ? weekDates(anchor) : [anchor], [anchor, mode]);
  const requestUrl = useMemo(() => appointmentRequestUrl(days, piercerId, stationId), [days, piercerId, stationId]);
  const loadedRequest = useRef(requestUrl);
  const requestSequence = useRef(0);
  const inFlightRequests = useRef(new Map<string, Promise<void>>());
  const visibleAppointments = useMemo(() => appointments.filter(isVisibleAppointment), [appointments]);

  async function load(background = false, url = requestUrl) {
    const existingRequest = inFlightRequests.current.get(url);
    if (existingRequest) return existingRequest;
    const sequence = ++requestSequence.current;
    if (!background) setLoading(true); setError("");
    const request = (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "Calendar could not be loaded.");
        if (sequence === requestSequence.current) setAppointments(body.data ?? []);
      } catch (reason) {
        if (sequence === requestSequence.current) setError(reason instanceof Error ? reason.message : "Calendar could not be loaded.");
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    })();
    const trackedRequest = request.finally(() => {
      if (inFlightRequests.current.get(url) === trackedRequest) inFlightRequests.current.delete(url);
    });
    inFlightRequests.current.set(url, trackedRequest);
    return trackedRequest;
  }
  useEffect(() => {
    if (loadedRequest.current === requestUrl) return;
    loadedRequest.current = requestUrl;
    const timer = window.setTimeout(() => void load(false, requestUrl), 0);
    return () => window.clearTimeout(timer);
  }, [requestUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    function refresh() { void load(true); }
    window.addEventListener(WORKSPACE_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, refresh);
  }, [anchor, mode, piercerId, stationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className={`${featureView} relative`}>
    <div className="mb-[15px] flex min-h-[58px] flex-wrap items-center gap-2 overflow-x-auto rounded-[17px_13px_18px_14px] border-2 border-hippy-ink bg-[#f1d39c] px-2.5 py-[9px] shadow-[3px_3px_0_#3b2923] max-[760px]:flex-nowrap" aria-label="Calendar controls">
      <button type="button" className={`${dashButton({ variant: "secondary" })} min-h-[38px] w-[39px] p-0 text-[10px] shadow-[1px_2px_0_#3b2923]`} aria-label={`Previous ${mode}`} onClick={() => setAnchor(shiftManilaDate(anchor, mode === "week" ? -7 : -1))}><ChevronLeft className="size-[18px] shrink-0 stroke-[#3b2923] stroke-[2.75]" aria-hidden="true"/></button>
      <button className={`${dashButton({ variant: "secondary" })} min-h-[38px] text-[10px] shadow-[1px_2px_0_#3b2923]`} onClick={() => setAnchor(manilaDate(new Date()))}>Today</button>
      <button type="button" className={`${dashButton({ variant: "secondary" })} min-h-[38px] w-[39px] p-0 text-[10px] shadow-[1px_2px_0_#3b2923]`} aria-label={`Next ${mode}`} onClick={() => setAnchor(shiftManilaDate(anchor, mode === "week" ? 7 : 1))}><ChevronRight className="size-[18px] shrink-0 stroke-[#3b2923] stroke-[2.75]" aria-hidden="true"/></button>
      <StudioSelect ariaLabel="Filter by piercer" value={piercerId} disabled={props.role === "piercer"} onValueChange={setPiercerId} triggerClassName="h-[38px] min-h-[38px] w-auto min-w-[145px] shadow-[1px_2px_0_#3b2923]" options={[{ value: "", label: "All piercers" }, ...props.staff.filter(isPiercer).map((person) => ({ value: person.id, label: person.displayName }))]} />
      <StudioSelect ariaLabel="Filter by station" value={stationId} onValueChange={setStationId} triggerClassName="h-[38px] min-h-[38px] w-auto min-w-[145px] shadow-[1px_2px_0_#3b2923]" options={[{ value: "", label: "All stations" }, ...props.stations.map((station) => ({ value: station.id, label: station.name }))]} />
      <div className="ml-auto flex shrink-0 rounded-[12px_9px_13px_10px] border-[1.5px] border-hippy-ink bg-[#d8aa82] p-[3px] shadow-[1px_2px_0_#3b2923] max-[760px]:ml-0" aria-label="Calendar view">
        <button className={cn("cursor-pointer rounded-lg border-0 bg-transparent px-[13px] py-[7px] font-extrabold text-[#654a41]", mode === "week" && "bg-[#fff3d0] text-[#b74827] shadow-[inset_0_0_0_1px_#3b2923]")} aria-pressed={mode === "week"} onClick={() => setMode("week")}>Week</button>
        <button className={cn("cursor-pointer rounded-lg border-0 bg-transparent px-[13px] py-[7px] font-extrabold text-[#654a41]", mode === "day" && "bg-[#fff3d0] text-[#b74827] shadow-[inset_0_0_0_1px_#3b2923]")} aria-pressed={mode === "day"} onClick={() => setMode("day")}>Day</button>
      </div>
      <button className={`${dashButton({ variant: "primary" })} min-h-[38px] text-[10px]`} onClick={() => setNewOpen(true)}><Plus size={16}/> New appointment</button>
    </div>
    {error && <p className={dashError} role="alert">{error}</p>}
    <section className={`${panel} relative border-2 shadow-[5px_5px_0_#3b2923]`} aria-busy={loading}>
      {loading ? <><span className="sr-only" role="status">Loading live appointments</span>{mode === "week" ? <div className="overflow-x-auto [scrollbar-color:#d5aa89_transparent] [scrollbar-width:thin]"><CalendarGridSkeleton/></div> : <DayListSkeleton/>}</>
        : mode === "week" ? <WeekCalendar days={days} anchor={anchor} appointments={visibleAppointments} now={now} onSelectDate={(date) => { setAnchor(date); setMode("day"); }} onSelectAppointment={setSelected}/>
          : <DayCalendar date={anchor} appointments={visibleAppointments} now={now} onSelectAppointment={setSelected}/>}
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
  const showNow = days.includes(today) && isCalendarMinuteVisible(currentMinutes);
  return <div className="overflow-x-auto [scrollbar-color:#d5aa89_transparent] [scrollbar-width:thin]">
    <div className="relative grid min-w-[1000px] grid-cols-[64px_repeat(var(--calendar-days),minmax(132px,1fr))] bg-[#fff9eb] max-[760px]:min-w-[884px] max-[760px]:grid-cols-[58px_repeat(var(--calendar-days),minmax(118px,1fr))]" style={{ "--calendar-days": days.length, gridTemplateRows: `${calendarHeaderHeight}px ${calendarBodyHeight}px` } as React.CSSProperties}>
      <div className="sticky top-0 z-5 flex flex-col items-center justify-center gap-0.5 border-b-[1.5px] border-hippy-ink bg-[#f0d09d] text-[#a24429] [&>svg]:w-4 [&>span]:text-[7px] [&>span]:font-extrabold [&>span]:tracking-[.5px]"><Clock3/><span>GMT+8</span></div>
      {days.map((date) => <button type="button" className={cn("sticky top-0 z-5 flex cursor-pointer flex-col items-center justify-center border-0 border-b-[1.5px] border-l border-dashed border-b-hippy-ink border-l-[#bb7f5d] bg-[#f0d09d] text-[#4b342c] transition hover:bg-[#f7bc73] [&>span]:text-[8px] [&>span]:font-[750] [&>span]:tracking-[.6px] [&>span]:text-[#80675d] [&>small]:text-[8px] [&>small]:font-[750] [&>small]:tracking-[.6px] [&>small]:text-[#80675d] [&>strong]:my-0.5 [&>strong]:grid [&>strong]:size-[29px] [&>strong]:place-items-center [&>strong]:rounded-full [&>strong]:text-[13px] [&>strong]:font-[750]", date === today && "bg-[#f5dd9d] [&>strong]:text-[#b54c28] [&>strong]:shadow-[inset_0_0_0_1.5px_#d96032]", date === anchor && "bg-hippy-orange [&>span]:text-[#fff4dd] [&>small]:text-[#fff4dd] [&>strong]:bg-[#fff4d7] [&>strong]:text-[#9f3d22] [&>strong]:shadow-[2px_2px_0_#3b2923]")} key={date} onClick={() => onSelectDate(date)} aria-label={`Open day view for ${formatLongDate(date)}`}>
        <span>{dayNames[weekday(date)]}</span><strong>{date.slice(8)}</strong><small>{formatMonth(date)}</small>
      </button>)}
      <div className="relative z-2 border-r-[1.5px] border-hippy-ink bg-[#f7e4bd]">{calendarHourLabels().map(({ hour, top }) => <span className="absolute right-2.5 translate-y-[5px] text-[8px] font-[650] text-[#8b7166]" key={hour} style={{ top }}>{formatHour(hour)}</span>)}<span className="absolute right-2.5 -translate-y-full text-[8px] font-black text-[#b74827]" style={{ top: calendarBodyHeight }}>{calendarEndLabel}</span></div>
      {days.map((date) => {
        const positionedAppointments = layoutOverlappingAppointments(appointments.filter((item) => manilaDate(item.starts_at) === date));
        return <div className={cn("relative border-l border-dashed border-[#c79370] bg-[#fff9eb] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_59px,#d9b493_60px)]", date === today && "bg-[#f9edcf]", date === anchor && "bg-[#fbe5c9]")} key={date}>
        {positionedAppointments.map(({ item, lane, laneCount }) => {
          const start = manilaMinutes(item.starts_at);
          const end = start + Math.round((new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60_000);
          const piercer = one(item.staff_profiles); const station = one(item.stations);
          const accessibleLabel = `${formatTime(item.starts_at)} to ${formatTime(item.ends_at)}, ${clientName(item)}, ${servicesLabel(item)}, ${piercer?.display_name ?? "Unassigned"}, ${station?.name ?? "No station"}`;
          const eventStyle = calendarEventStyle(start, end);
          return <button type="button" key={item.id} className={cn("absolute left-[calc((100%/var(--event-lanes))*var(--event-lane)+4px)] z-2 min-h-[34px] w-[calc(100%/var(--event-lanes)-8px)] cursor-pointer overflow-hidden rounded-[10px_7px_11px_8px] border border-l-[5px] border-hippy-ink border-l-[var(--event-color)] bg-[color-mix(in_srgb,var(--event-color)_25%,#fff6df)] px-2 py-1.5 text-left text-[#432e27] shadow-[2px_2px_0_#3b2923] transition hover:z-7 hover:-translate-x-px hover:-translate-y-0.5 hover:shadow-[4px_5px_0_#3b2923] focus-visible:z-7 focus-visible:-translate-x-px focus-visible:-translate-y-0.5 focus-visible:shadow-[4px_5px_0_#3b2923] [&>strong]:block [&>strong]:overflow-hidden [&>strong]:text-[9px] [&>strong]:text-ellipsis [&>strong]:whitespace-nowrap [&>small]:mt-0.5 [&>small]:block [&>small]:overflow-hidden [&>small]:text-[8px] [&>small]:text-ellipsis [&>small]:whitespace-nowrap [&>i]:mt-0.5 [&>i]:block [&>i]:overflow-hidden [&>i]:text-[8px] [&>i]:text-ellipsis [&>i]:whitespace-nowrap [&>i]:not-italic [&>i]:text-[#765d53]", item.status === "completed" && "opacity-70")} style={{
            top: eventStyle.top,
            height: eventStyle.height,
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
      {showNow && <div className="pointer-events-none absolute right-0 left-[60px] z-8 h-0.5 bg-[#b94735] max-[760px]:left-[54px]" style={{ top: calendarHeaderHeight + calendarMinuteTop(currentMinutes) }} aria-hidden="true"><span className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full border-[1.5px] border-hippy-ink bg-hippy-orange"/></div>}
    </div>
  </div>;
}

function DayCalendar({ date, appointments, now, onSelectAppointment }: { date: string; appointments: RawAppointment[]; now: Date; onSelectAppointment: (appointment: RawAppointment) => void }) {
  const items = appointments.filter((item) => manilaDate(item.starts_at) === date).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return <div className="grid min-h-[330px] grid-cols-[112px_minmax(0,1fr)] bg-[#fff9eb] max-[760px]:grid-cols-[70px_minmax(0,1fr)]">
    <aside className={cn("relative flex min-h-[330px] flex-col items-center justify-center overflow-hidden border-r-[1.5px] border-dashed border-[#a96749] bg-[#f0c875] before:absolute before:top-[22px] before:left-[18px] before:-rotate-12 before:text-2xl before:text-[#b34829] before:content-['✦'] after:absolute after:right-4 after:bottom-6 after:rotate-12 after:text-[31px] after:text-[#795d8e] after:content-['☾'] max-[760px]:before:left-[9px] max-[760px]:before:text-base max-[760px]:after:right-2 max-[760px]:after:text-[21px] [&>span]:text-[9px] [&>span]:font-[950] [&>span]:tracking-[1.4px] [&>span]:text-[#a24429] [&>strong]:my-[5px] [&>strong]:font-display [&>strong]:text-[34px]/none [&>strong]:font-extrabold [&>strong]:text-hippy-ink max-[760px]:[&>strong]:text-[27px] [&>small]:text-[10px] [&>small]:font-[750] [&>small]:text-[#76584d]", date === manilaDate(now) && "bg-hippy-orange before:text-[#f6d16f] after:text-[#f6d16f] [&>span]:text-[#fff7e4] [&>strong]:text-[#fff7e4] [&>small]:text-[#fff7e4]")}>
      <span>{dayNames[weekday(date)]}</span><strong>{date.slice(8)}</strong><small>{formatMonth(date)}</small>
    </aside>
    <div className="min-w-0 bg-[#fff9eb]">
      <header className="flex min-h-[74px] items-center justify-between gap-[15px] border-b border-dashed border-[#c88f6e] bg-[#f8e3bc] px-[18px] py-[13px] max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-[7px] max-[760px]:px-[13px] max-[760px]:py-3 [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-[17px] [&_h3]:font-[760] [&_h3]:text-hippy-ink [&_p]:mt-[5px] [&_p]:mb-0 [&_p]:text-[9px] [&_p]:text-[#80665c] [&>span]:rounded-full [&>span]:border [&>span]:border-hippy-ink [&>span]:bg-[#d8e4c7] [&>span]:px-[9px] [&>span]:py-1.5 [&>span]:text-[8px] [&>span]:font-black [&>span]:text-[#3e604f] [&>span]:whitespace-nowrap [&>span]:shadow-[1px_1px_0_#3b2923]"><div><h3>{formatLongDate(date)}</h3><p>Daily appointment list · Asia/Manila</p></div><span>{items.length} appointment{items.length === 1 ? "" : "s"}</span></header>
      {items.length ? <div className="flex flex-col">{items.map((item) => {
        const piercer = one(item.staff_profiles); const station = one(item.stations);
        return <button type="button" className="grid min-h-[78px] cursor-pointer grid-cols-[80px_38px_minmax(150px,1fr)_minmax(135px,.65fr)_92px_18px] items-center gap-[11px] border-0 border-b border-l-[5px] border-dashed border-b-[#d7a47f] border-l-transparent bg-[#fff9eb] px-[17px] py-2.5 text-left text-[#49332c] transition last:border-b-0 hover:translate-x-0.5 hover:border-l-[var(--event-color)] hover:bg-[#f8dcae] focus-visible:translate-x-0.5 focus-visible:border-l-[var(--event-color)] focus-visible:bg-[#f8dcae] focus-visible:shadow-[inset_0_0_0_2px_#3b2923] focus-visible:outline-0 max-[760px]:grid-cols-[63px_34px_minmax(0,1fr)_18px] max-[760px]:gap-2 max-[760px]:px-[11px]" key={item.id} onClick={() => onSelectAppointment(item)} style={{ "--event-color": piercer?.color ?? "#e86f2c" } as React.CSSProperties}>
          <span className="flex min-w-0 flex-col [&_strong]:overflow-hidden [&_strong]:text-[10px] [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_small]:mt-1 [&_small]:overflow-hidden [&_small]:text-[8px] [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[#80675d]"><strong>{formatTime(item.starts_at)}</strong><small>{formatTime(item.ends_at)}</small></span>
          <span className="grid size-[34px] place-items-center rounded-[50%_42%_50%_45%] border-[1.5px] border-hippy-ink bg-[color-mix(in_srgb,var(--event-color)_34%,#f7d69c)] text-[9px] font-black text-[#4e3025] shadow-[1px_1px_0_#3b2923]">{initials(clientName(item))}</span>
          <span className="flex min-w-0 flex-col [&_strong]:overflow-hidden [&_strong]:text-[10px] [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_small]:mt-1 [&_small]:overflow-hidden [&_small]:text-[8px] [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[#80675d] max-[760px]:[&_small]:whitespace-normal max-[760px]:[&_small]:leading-[1.35]"><strong>{clientName(item)}</strong><small>{servicesLabel(item)} · {item.reference}</small></span>
          <span className="flex min-w-0 items-center gap-2 text-[9px] max-[760px]:hidden [&>i]:size-2 [&>i]:shrink-0 [&>i]:rounded-full [&>i]:bg-[var(--event-color)] [&>span]:flex [&>span]:min-w-0 [&>span]:flex-col [&_small]:mt-1 [&_small]:overflow-hidden [&_small]:text-[8px] [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[#80675d]"><i/><span>{piercer?.display_name ?? "Unassigned"}<small>{station?.name ?? "No station"}</small></span></span>
          <span className={`${statusClasses(item.status)} max-[760px]:hidden`}>{item.status.replace("_", " ")}</span>
          <ChevronRight className="w-[15px] text-[#9d7767] max-[760px]:col-start-4" aria-hidden="true"/>
        </button>;
      })}</div> : <div className="flex min-h-[256px] flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_46%,#efb83f1b_0_70px,transparent_72px)] p-[30px] text-center text-[#795e53] [&>svg]:mb-2.5 [&>svg]:size-[34px] [&>svg]:rounded-[50%_43%_50%_45%] [&>svg]:border-[1.5px] [&>svg]:border-hippy-ink [&>svg]:bg-hippy-sage [&>svg]:p-[7px] [&>svg]:text-[#315342] [&>svg]:shadow-[3px_3px_0_#3b2923] [&>h3]:m-0 [&>h3]:font-display [&>h3]:text-lg [&>h3]:font-[750] [&>h3]:text-[#49332c] [&>p]:mt-1.5 [&>p]:mb-0 [&>p]:text-[10px]"><Clock3/><h3>No appointments this day</h3><p>The selected date is clear for the current filters.</p></div>}
    </div>
  </div>;
}

function AppointmentFormDialog(props: Props & { initialDate: string; onClose: () => void; onSaved: () => void }) {
  const activeServices = props.services.filter((service) => service.isActive);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientLabel, setClientLabel] = useState("");
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [piercerId, setPiercerId] = useState(props.role === "piercer" ? props.userId : "");
  const [stationId, setStationId] = useState("");
  const [date, setDate] = useState(props.initialDate);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const selectedServices = activeServices.filter((service) => serviceIds.includes(service.id));
  const visibleServices = activeServices.filter((service) => service.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()));
  const duration = combinedServiceDuration(selectedServices);
  const eligible = props.staff.filter((person) => isPiercer(person) && person.active &&
    serviceIds.every((serviceId) => props.assignments.some((item) => item.serviceId === serviceId && item.staffId === person.id)));
  const effectivePiercerId = eligible.some((person) => person.id === piercerId)
    ? piercerId : props.role === "piercer" ? props.userId : "";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const payload = {
      serviceIds, startsAt: `${date}T${time}:00+08:00`, piercerId: effectivePiercerId,
      stationId: form.get("stationId") || null, customerId: clientMode === "existing" ? form.get("customerId") : null,
      customer: clientMode === "new" ? { firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), phone: form.get("phone") } : null,
      notes: form.get("notes") || null, sendConfirmation,
    };
    const response = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error?.message ?? "Appointment could not be created."); return; }
    props.onSaved();
  }
  const chosenPiercer = props.staff.find((person) => person.id === effectivePiercerId);
  const chosenStation = props.stations.find((station) => station.id === stationId);
  const clientSummary = clientMode === "existing" ? cleanClientLabel(clientLabel) : `${newClient.firstName} ${newClient.lastName}`.trim();
  const boundary = date && time && duration ? appointmentDayBoundary(date, time, duration) : null;
  const endsAt = boundary?.endsAt ?? null;
  const dayHours = props.studio.businessHours[String(weekday(date))];
  const studioScheduleIssue = endsAt && (!dayHours || dayHours.closed
    ? "The studio is closed on this date."
    : endsAt > manilaSchedulingEnd(date, dayHours.close)
      ? `The studio closes at ${compactScheduleTime(dayHours.close)}.`
      : null);
  const piercerScheduleIssue = endsAt && effectivePiercerId && !props.availability.some((block) =>
    block.staffId === effectivePiercerId &&
    (block.availabilityDate ? block.availabilityDate === date : block.weekday === weekday(date)) &&
    new Date(`${date}T${time}:00+08:00`) >= manilaDateTime(date, block.startsAt.slice(0, 5)) &&
    endsAt <= manilaSchedulingEnd(date, block.endsAt.slice(0, 5)),
  ) ? `${chosenPiercer?.displayName ?? "The selected piercer"} is not available through ${formatTime(endsAt.toISOString())}.` : null;
  const missing = [
    !serviceIds.length && "Services",
    !clientSummary && (clientMode === "existing" ? "Client" : "New client name"),
    clientMode === "new" && (!newClient.email || !newClient.phone) && "New client contact",
    !effectivePiercerId && "Piercer",
    (!date || !time) && "Date and time",
    boundary?.endsPastMidnight && "Choose a start time that ends by midnight",
    studioScheduleIssue,
    piercerScheduleIssue,
  ].filter(Boolean) as string[];
  const readinessMissing = error ? [...missing, "Resolve the issue above"] : missing;
  return <Dialog title="New appointment" detail="Studio-created bookings ignore public lead time and horizon limits." onClose={props.onClose}>
    <form className="grid grid-cols-[minmax(0,1fr)_320px] max-[900px]:grid-cols-1" onSubmit={submit}>
      <div className="flex flex-col gap-4 p-[21px] max-[700px]:p-4">
        <section className="flex flex-col gap-2.5">
          <SectionHead index="1" title="Services" meta={`${serviceIds.length} selected · ${duration} min`}/>
          <label className="relative block [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:top-1/2 [&>svg]:left-3 [&>svg]:w-4 [&>svg]:-translate-y-1/2 [&>svg]:text-[#9a6b55]"><Search/><input className="min-h-[43px] w-full rounded-[10px_7px_11px_8px] border-[1.5px] border-hippy-ink bg-[#fffaf0] py-2.5 pr-3 pl-9 text-[11px] shadow-[2px_2px_0_#d9a47e]" type="search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search services" aria-label="Search services"/></label>
          <fieldset className="grid max-h-[250px] grid-cols-2 gap-[7px] overflow-auto rounded-[14px] border-[1.5px] border-hippy-ink bg-[#fae5bf] p-2.5 [scrollbar-color:#d5aa89_transparent] [scrollbar-width:thin] max-[700px]:grid-cols-1"><legend className="sr-only">Services</legend>{visibleServices.map((service) => {
            const selected = serviceIds.includes(service.id);
            return <label className={cn("grid min-h-[54px] cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px_9px_13px_10px] border-[1.5px] border-[#bc7c57] bg-[#fff8e8] p-2 text-[10px] transition", selected && "-translate-x-px -translate-y-px border-2 border-hippy-ink bg-[#f0c66e] shadow-[3px_3px_0_#3b2923]")} key={service.id}>
              <input className="peer sr-only" type="checkbox" checked={selected} onChange={(event) => { setError(""); setServiceIds((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id)); }}/>
              <span className="grid size-5 place-items-center rounded-[6px_4px_7px_5px] border-2 border-hippy-ink bg-white text-transparent leading-none peer-checked:bg-hippy-orange peer-checked:text-white [&>svg]:block [&>svg]:size-[11px]"><Check/></span>
              <span className="min-w-0"><strong className="block overflow-hidden text-ellipsis whitespace-nowrap">{service.name}</strong><small className="mt-1 block text-[8px] text-[#81665c]">{qualifiedNames(service.id, props).join(", ") || "No eligible piercer"}</small></span>
              <small className="rounded-full border border-dashed border-[#9f6a4d] bg-[#fff5df] px-2 py-1 text-[8px] font-black whitespace-nowrap">{service.durationMinutes} min</small>
            </label>;
          })}</fieldset>
        </section>
        <section className="border-t border-dashed border-[#c88f6e] pt-4">
          <SectionHead index="2" title="Client"/>
          <div className="mb-3 grid grid-cols-2 rounded-xl border-[1.5px] border-hippy-ink bg-[#d9ac83] p-[3px] shadow-[1px_2px_0_#3b2923] [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-2 [&>button]:font-extrabold"><button type="button" className={clientMode === "existing" ? "bg-[#fff4d7]! text-[#b74827] shadow-[1px_1px_0_#3b2923]" : ""} aria-pressed={clientMode === "existing"} onClick={() => setClientMode("existing")}>Existing client</button><button type="button" className={clientMode === "new" ? "bg-[#fff4d7]! text-[#b74827] shadow-[1px_1px_0_#3b2923]" : ""} aria-pressed={clientMode === "new"} onClick={() => setClientMode("new")}>New client</button></div>
          {clientMode === "existing" ? <label className={dashField}>Client<CustomerSelect required onSelectionLabelChange={setClientLabel}/></label>
            : <div className={operationGrid}><label className={dashField}>First name<input name="firstName" value={newClient.firstName} onChange={(event) => setNewClient((current) => ({ ...current, firstName: event.target.value }))} required/></label><label className={dashField}>Last name<input name="lastName" value={newClient.lastName} onChange={(event) => setNewClient((current) => ({ ...current, lastName: event.target.value }))} required/></label><label className={dashField}>Email<input name="email" type="email" value={newClient.email} onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))} required/></label><label className={dashField}>Phone<input name="phone" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: event.target.value }))} required/></label></div>}
        </section>
        <section className="border-t border-dashed border-[#c88f6e] pt-4">
          <SectionHead index="3" title="Schedule" meta="Asia/Manila"/>
          <div className={operationGrid}><label className={dashField}>Eligible piercer<StudioSelect value={effectivePiercerId} onValueChange={(value) => { setError(""); setPiercerId(value); }} required disabled={props.role === "piercer"} ariaLabel="Eligible piercer" options={[{ value: "", label: "Choose eligible piercer" }, ...eligible.map((person) => ({ value: person.id, label: person.displayName }))]} /></label>
            <label className={dashField}>Station<StudioSelect name="stationId" value={stationId} onValueChange={(value) => { setError(""); setStationId(value); }} ariaLabel="Station" options={[{ value: "", label: "No station" }, ...props.stations.map((station) => ({ value: station.id, label: station.name }))]} /></label>
            <label className={dashField}>Date<input name="date" type="date" value={date} onChange={(event) => { setError(""); setDate(event.target.value); }} required/></label><label className={dashField}>Manila time<input name="time" type="time" value={time} onChange={(event) => { setError(""); setTime(event.target.value); }} required/></label></div>
          <p className={cn("mt-3 mb-0 flex items-center gap-[7px] rounded-[11px] border border-dashed border-[#ba7652] bg-[#f8dcae] px-3 py-2.5 text-[11px] text-[#60463c] [&>svg]:w-4", (boundary?.endsPastMidnight || studioScheduleIssue || piercerScheduleIssue) && "border-[#a33e30] bg-[#f2c8b6] text-[#783321]", boundary?.endsAtMidnight && !studioScheduleIssue && !piercerScheduleIssue && "border-[#4d745e] bg-[#d8e5cf] text-[#315342]")}><Clock3/> Combined duration: <strong>{duration} minutes</strong>. {boundary?.endsPastMidnight ? "This ends after midnight. Cross-day appointments are not supported." : studioScheduleIssue ?? piercerScheduleIssue ?? (boundary?.endsAtMidnight ? "Ends exactly at midnight — valid end-of-day boundary." : "End time is calculated automatically.")}</p>
        </section>
        <section className="border-t border-dashed border-[#c88f6e] pt-4 opacity-90">
          <SectionHead index="4" title="Notes / additional details"/>
          <label className={dashField}>Notes<textarea name="notes" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)}/></label>
          <label className="relative mt-2 flex min-h-auto cursor-pointer items-center gap-2 p-[9px_11px] text-[9px] text-[#71594f]"><input className="peer absolute opacity-0" name="sendConfirmation" type="checkbox" checked={sendConfirmation} onChange={(event) => setSendConfirmation(event.target.checked)}/><span className="grid size-[18px] place-items-center rounded-[5px] border-2 border-hippy-ink bg-white text-transparent leading-none peer-checked:bg-hippy-orange peer-checked:text-white [&>svg]:block [&>svg]:size-[11px]"><Check/></span> Email a confirmation to the client</label>
          {error && <p className={dashError} role="alert">{error}</p>}
        </section>
      </div>
      <aside className="sticky top-[74px] m-0 flex h-full min-h-full self-stretch flex-col border-l border-dashed border-[#bb7f5d] bg-[#f6dcae] p-[17px] max-[900px]:static max-[900px]:border-t max-[900px]:border-l-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px_13px_19px_14px] border-2 border-hippy-ink bg-[#fff8e8] shadow-[4px_4px_0_#3b2923]">
          <header className="border-b border-dashed border-[#c98965] bg-[#fff1cf] p-[15px]"><strong className="block font-display text-[18px] font-[760] text-hippy-ink">Appointment Summary</strong><small className="mt-1 block text-[10px] text-[#765c52]">Live review before creation</small></header>
          <dl className="m-0 grid min-h-0 flex-1 content-start gap-3 overflow-auto p-[15px] text-[11px] [scrollbar-color:#d5aa89_transparent] [scrollbar-width:thin] [&_dt]:mb-1 [&_dt]:text-[8px] [&_dt]:font-black [&_dt]:tracking-[.8px] [&_dt]:text-[#a34d30] [&_dt]:uppercase [&_dd]:m-0 [&_dd]:leading-[1.45]">{summaryRow("Services", selectedServices.length ? <span className="flex flex-wrap gap-1.5">{selectedServices.map((service) => <span className="rounded-[10px_8px_11px_9px] border-[1.5px] border-hippy-ink bg-[#f0c66e] px-2 py-1.5 font-black shadow-[1px_1px_0_#3b2923]" key={service.id}>{service.name}</span>)}</span> : <span className="text-[#82675d] italic">Not selected</span>)}
            {summaryRow("Total duration", duration ? `${duration} min` : <span className="text-[#82675d] italic">Not selected</span>)}
            {summaryRow("Client", clientSummary || <span className="text-[#82675d] italic">{clientMode === "existing" ? "Choose a client" : "Enter new client details"}</span>)}
            {summaryRow("Piercer", chosenPiercer?.displayName ?? <span className="text-[#82675d] italic">Choose a piercer</span>)}
            {summaryRow("Station", chosenStation?.name ?? "No station")}
            {summaryRow("Date & time", date && time ? `${formatShortDate(date)} · ${formatTime(`${date}T${time}:00+08:00`)}` : <span className="text-[#82675d] italic">Choose date and time</span>)}
            {summaryRow("Ends", endsAt ? <span>{formatShortDate(manilaDate(endsAt))} · {formatTime(endsAt.toISOString())}{boundary?.endsAtMidnight && <small className="mt-1 block font-bold text-[#315342]">Valid midnight endpoint</small>}{boundary?.endsPastMidnight && <small className="mt-1 block font-bold text-[#a33e30]">Crosses midnight — choose an earlier start</small>}</span> : <span className="text-[#82675d] italic">Select services and a start time</span>)}
            {summaryRow("Notes", notes.trim() || <span className="text-[#82675d] italic">No notes</span>)}</dl>
          <div className={cn("mx-[15px] mb-[14px] rounded-[14px_10px_15px_11px] border-[1.5px] border-hippy-ink bg-[#fff5df] p-3 text-[10px] leading-[1.55]", !readinessMissing.length && "bg-[#d8e5cf] text-[#315342]")}><strong className="block text-[12px]">{readinessMissing.length ? "Still needed:" : "Ready to create"}</strong>{readinessMissing.length ? <ul className="my-1.5 pl-5">{readinessMissing.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-1">Server validation still checks qualifications, hours, availability, and conflicts.</p>}</div>
          <footer className="flex shrink-0 flex-wrap justify-end gap-[9px] border-t border-dashed border-[#c98965] bg-[#fff1cf] p-[15px]"><button type="button" className={dashButton({ variant: "secondary" })} onClick={props.onClose}>Cancel</button><button className={dashButton({ variant: "primary" })} disabled={busy || Boolean(readinessMissing.length)}>{busy ? "Creating…" : "Create appointment"}</button></footer>
        </div>
      </aside>
    </form>
  </Dialog>;
}

function SectionHead({ index, title, meta }: { index: string; title: string; meta?: string }) {
  return <div className="mb-2.5 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[10px] font-black tracking-[1px] text-[#a34d30] uppercase"><span className="grid size-[23px] place-items-center rounded-[50%_43%_54%_45%] border-[1.5px] border-hippy-ink bg-hippy-gold text-[10px] text-[#59351c] shadow-[1px_1px_0_#3b2923]">{index}</span>{title}</span>{meta && <span className="rounded-full border border-hippy-ink bg-[#d8e4c7] px-2.5 py-1.5 text-[8px] font-black text-[#315342] shadow-[1px_1px_0_#3b2923] whitespace-nowrap">{meta}</span>}</div>;
}

function summaryRow(label: string, value: ReactNode) {
  return <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2.5 max-[520px]:grid-cols-1 max-[520px]:gap-1"><dt>{label}</dt><dd>{value}</dd></div>;
}

function qualifiedNames(serviceId: string, props: Props) {
  return props.staff
    .filter((person) => isPiercer(person) && props.assignments.some((assignment) => assignment.serviceId === serviceId && assignment.staffId === person.id))
    .map((person) => person.displayName.split(" ")[0]);
}

function cleanClientLabel(value: string) {
  return value.replace(/\s+·\s+.+$/, "");
}

function AppointmentDialog(props: Props & { appointment: RawAppointment; onClose: () => void; onSaved: () => void }) {
  const item = props.appointment; const [reschedule, setReschedule] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const services = item.booking_services.sort(byPosition); const customer = one(item.customers)!; const piercer = one(item.staff_profiles); const station = one(item.stations); const sale = one(item.sales);
  const eligible = props.staff.filter((person) => isPiercer(person) && person.active && services.every((service) => props.assignments.some((assignment) => assignment.serviceId === service.service_id && assignment.staffId === person.id)));
  async function mutate(payload: Record<string, unknown>) { setBusy(true); setError(""); const response = await fetch(`/api/appointments/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); setBusy(false); if (!response.ok) { setError(body.error?.message ?? "Appointment could not be updated."); return; } props.onSaved(); }
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate({ startsAt: `${form.get("date")}T${form.get("time")}:00+08:00`, piercerId: props.role === "piercer" ? item.assigned_piercer_id : form.get("piercerId"), stationId: form.get("stationId") || null }); }
  return <Dialog title={reschedule ? "Reschedule appointment" : `${customer.first_name} ${customer.last_name}`} detail={`${item.reference} · ${item.status.replace("_", " ")}`} onClose={props.onClose}>
    {reschedule ? <form className={operationForm} onSubmit={submit}>
      <p className="m-0 flex items-center gap-[7px] rounded-[11px] border border-dashed border-[#ba7652] bg-[#f8dcae] px-3 py-2.5 text-[11px] text-[#60463c]">The combined {services.reduce((sum, service) => sum + service.duration_minutes, 0)}-minute duration, studio hours, closures, qualifications, availability, and overlaps will be checked.</p>
      <div className={operationGrid}><label className={dashField}>Date<input name="date" type="date" defaultValue={manilaDate(item.starts_at)} required/></label><label className={dashField}>Manila time<input name="time" type="time" defaultValue={manilaTimeValue(item.starts_at)} required/></label>
        <label className={dashField}>Piercer<StudioSelect name="piercerId" defaultValue={item.assigned_piercer_id} disabled={props.role === "piercer"} ariaLabel="Piercer" options={eligible.map((person) => ({ value: person.id, label: person.displayName }))} /></label><label className={dashField}>Station<StudioSelect name="stationId" defaultValue={item.station_id ?? ""} ariaLabel="Station" options={[{ value: "", label: "No station" }, ...props.stations.map((entry) => ({ value: entry.id, label: entry.name }))]} /></label></div>
      {error && <p className={dashError} role="alert">{error}</p>}<footer><button type="button" className={dashButton({ variant: "secondary" })} onClick={() => { setReschedule(false); setError(""); }}>Back</button><button className={dashButton({ variant: "primary" })} disabled={busy}>{busy ? "Checking…" : "Save new schedule"}</button></footer>
    </form> : <div className="flex flex-col gap-[15px] p-[21px] max-[700px]:p-4 [&>footer]:mt-1 [&>footer]:flex [&>footer]:flex-wrap [&>footer]:justify-end [&>footer]:gap-[9px]">
      <div className="flex flex-wrap gap-[7px] [&>span]:rounded-xl [&>span]:border-[1.5px] [&>span]:border-hippy-ink [&>span]:bg-[#f0c66e] [&>span]:px-[11px] [&>span]:py-2 [&>span]:text-[11px] [&>span]:font-black [&_small]:mt-[3px] [&_small]:block [&_small]:font-medium">{services.map((service) => <span key={service.id}>{service.name}<small>{service.duration_minutes} minutes</small></span>)}</div>
      <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-[1.5px] border-hippy-ink bg-hippy-ink max-[700px]:grid-cols-1 [&>div]:bg-[#fff9eb] [&>div]:p-3 [&_dt]:mb-[5px] [&_dt]:text-[8px] [&_dt]:font-black [&_dt]:tracking-[.8px] [&_dt]:text-[#a34d30] [&_dt]:uppercase [&_dd]:m-0 [&_dd]:text-[11px]/[1.55]"><div><dt>When</dt><dd>{formatLongDate(manilaDate(item.starts_at))}<br/>{formatTime(item.starts_at)}–{formatTime(item.ends_at)}</dd></div><div><dt>Piercer</dt><dd>{piercer?.display_name ?? "Unassigned"}</dd></div><div><dt>Station</dt><dd>{station?.name ?? "No station"}</dd></div><div><dt>Linked sale</dt><dd>{sale?.status ?? "Not created"}</dd></div><div><dt>Contact</dt><dd>{customer.email}<br/>{customer.phone}</dd></div><div><dt>Notes</dt><dd>{item.notes || "No notes"}</dd></div></dl>
      {error && <p className={dashError} role="alert">{error}</p>}
      <footer><button className={dashButton({ variant: "secondary" })} onClick={() => setReschedule(true)}>Reschedule</button>{item.status === "confirmed" && <><button className={dashButton({ variant: "secondary" })} disabled={busy} onClick={() => void mutate({ status: "no_show" })}>No-show</button><button className={dashButton({ variant: "primary" })} disabled={busy} onClick={() => void mutate({ status: "completed" })}>Complete & create sale</button><button className={`${dashButton({ variant: "primary" })} bg-[#b94735]`} disabled={busy} onClick={() => void mutate({ status: "cancelled" })}>Cancel</button></>}</footer>
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
  return <div className={operationBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={operationDialog} role="dialog" aria-modal="true" aria-labelledby="operation-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="operation-dialog-title">{title}</h2><p>{detail}</p></div><button aria-label="Close dialog" onClick={onClose}><X/></button></header>{children}
  </div></div>;
}

function one<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] : value; }
function byPosition(a: { position: number }, b: { position: number }) { return a.position - b.position; }
function isPiercer(person: StaffRecord) { return person.role === "piercer" && person.active; }
function isVisibleAppointment(item: RawAppointment) { return !["cancelled", "rejected"].includes(item.status); }
function appointmentRequestUrl(days: string[], piercerId: string, stationId: string) {
  const query = new URLSearchParams({ from: days[0], to: days.at(-1)! });
  if (piercerId) query.set("piercerId", piercerId);
  if (stationId) query.set("stationId", stationId);
  return `/api/appointments?${query}`;
}
function clientName(item: RawAppointment) { const customer = one(item.customers); return customer ? `${customer.first_name} ${customer.last_name}` : "Client"; }
function servicesLabel(item: RawAppointment) { return [...item.booking_services].sort(byPosition).map((service) => service.name).join(" + ") || "No services"; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PC"; }
function weekday(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
function shiftDate(date: string, days: number) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function weekDates(anchor: string) { const start = shiftDate(anchor, -weekday(anchor)); return Array.from({ length: 7 }, (_, index) => shiftDate(start, index)); }
function formatMonth(date: string) { return new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatShortDate(date: string) { return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatLongDate(date: string) { return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatHour(hour: number) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, hour))); }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function compactScheduleTime(value: string) { return value.startsWith("24:00") || value.startsWith("23:59") ? "12:00 AM" : new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(`2020-01-01T${value.slice(0, 5)}:00Z`)); }
function manilaTimeValue(value: string) { const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).formatToParts(new Date(value)); return `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`; }
function manilaMinutes(value: string) { const [hour, minute] = manilaTimeValue(value).split(":").map(Number); return hour * 60 + minute; }
