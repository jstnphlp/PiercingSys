"use client";

import { ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { manilaDate, manilaWeekDates, manilaWeekday, shiftManilaDate, type StudioSettings } from "@/lib/domain";
import type { AvailabilityRecord, ClosureRecord, StaffRecord } from "@/lib/data/staff";
import { Dialog } from "./calendar-workspace";

const startHour = 8, endHour = 21, hourHeight = 54;
const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
type Editor = { kind: "hours" | "availability" | "closure"; id?: string; weekday: number; date: string; start: string; end: string; staffId?: string; reason?: string | null };

export function ScheduleSettings({ studio, staff, availability, closures }: { studio: StudioSettings; staff: StaffRecord[]; availability: AvailabilityRecord[]; closures: ClosureRecord[] }) {
  const [anchor, setAnchor] = useState(() => manilaDate(new Date())); const [editor, setEditor] = useState<Editor | null>(null);
  const week = useMemo(() => manilaWeekDates(anchor), [anchor]);
  return <section className="panel setting-section schedule-settings"><div className="panel-head"><div><h3>Hours, availability & closures</h3><p>Studio and staff hours repeat every weekday. Closure overlays apply only to their dated range.</p></div><button className="btn btn-secondary" onClick={() => setEditor({ kind: "availability", weekday: manilaWeekday(anchor), date: anchor, start: "10:00", end: "11:00" })}><Plus/> Add schedule block</button></div>
    <div className="schedule-legend"><span className="studio">Studio hours</span>{staff.filter((person) => person.role === "piercer" && person.active).map((person) => <span key={person.id} style={{ "--legend": person.color } as React.CSSProperties}>{person.displayName}</span>)}<span className="closure">Closure</span><div><button aria-label="Previous week" onClick={() => setAnchor(shiftManilaDate(anchor, -7))}><ChevronLeft/></button><button onClick={() => setAnchor(manilaDate(new Date()))}>Today</button><button aria-label="Next week" onClick={() => setAnchor(shiftManilaDate(anchor, 7))}><ChevronRight/></button></div></div>
    <div className="calendar-scroll"><div className="calendar-grid schedule-grid" style={{ "--calendar-days": 7 } as React.CSSProperties}><div className="calendar-corner"><Clock3/></div>{week.map((date) => <div className={`calendar-date ${date === manilaDate(new Date()) ? "today" : ""}`} key={date}><span>{names[manilaWeekday(date)]}</span><strong>{date.slice(8)}</strong><small>{month(date)}</small></div>)}
      <div className="calendar-times">{Array.from({ length: endHour - startHour + 1 }, (_, index) => <span key={index} style={{ top: index * hourHeight }}>{hourLabel(startHour + index)}</span>)}</div>
      {week.map((date) => { const day = manilaWeekday(date); const hours = studio.businessHours[String(day)]; return <div className="calendar-column" key={date} onDoubleClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const minute = Math.max(startHour * 60, Math.min(endHour * 60 - 30, Math.round(((event.clientY - rect.top) / hourHeight * 60 + startHour * 60) / 30) * 30)); setEditor({ kind: "availability", weekday: day, date, start: time(minute), end: time(minute + 60) }); }}>
        {hours && !hours.closed && <button className="schedule-block studio-hours" style={blockStyle(hours.open, hours.close)} onClick={(event) => { event.stopPropagation(); setEditor({ kind: "hours", weekday: day, date, start: hours.open, end: hours.close }); }}><strong>Studio open</strong><small>{hours.open}–{hours.close}</small></button>}
        {availability.filter((item) => item.weekday === day).map((item) => { const person = staff.find((entry) => entry.id === item.staffId); return <button key={item.id} className="schedule-block staff-hours" style={{ ...blockStyle(item.startsAt, item.endsAt), "--schedule-color": person?.color ?? "#795d8e" } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); setEditor({ kind: "availability", id: item.id, weekday: day, date, start: item.startsAt.slice(0,5), end: item.endsAt.slice(0,5), staffId: item.staffId }); }}><strong>{person?.displayName ?? "Staff"}</strong><small>{item.startsAt.slice(0,5)}–{item.endsAt.slice(0,5)}</small></button>; })}
        {closures.filter((item) => manilaDate(item.startsAt) === date).map((item) => <button key={item.id} className="schedule-block closure-block" style={blockStyle(manilaTime(item.startsAt), manilaTime(item.endsAt))} onClick={(event) => { event.stopPropagation(); setEditor({ kind: "closure", id: item.id, weekday: day, date, start: manilaTime(item.startsAt), end: manilaTime(item.endsAt), reason: item.reason }); }}><strong>Closed</strong><small>{item.reason || "No reason"}</small></button>)}
      </div>; })}
    </div></div><p className="schedule-hint">Double-click an empty time range to add availability. Select any block to edit or delete it.</p>
    {editor && <ScheduleEditor value={editor} staff={staff} onClose={() => setEditor(null)}/>} 
  </section>;
}

function ScheduleEditor({ value, staff, onClose }: { value: Editor; staff: StaffRecord[]; onClose: () => void }) {
  const [kind, setKind] = useState(value.kind); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); let url = "", method = value.id ? "PATCH" : "POST", payload: Record<string, unknown> = {};
    if (kind === "hours") { url = `/api/settings/business-hours/${value.weekday}`; method = "PATCH"; payload = { open: form.get("start"), close: form.get("end") }; }
    else if (kind === "availability") { url = value.id ? `/api/availability/${value.id}` : "/api/availability"; payload = { staffId: form.get("staffId"), weekday: value.weekday, startsAt: form.get("start"), endsAt: form.get("end") }; }
    else { url = value.id ? `/api/closures/${value.id}` : "/api/closures"; payload = { startsAt: `${form.get("date")}T${form.get("start")}:00+08:00`, endsAt: `${form.get("date")}T${form.get("end")}:00+08:00`, reason: form.get("reason") || null }; }
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); setBusy(false); if (!response.ok) { setError(body.error?.message ?? "Schedule could not be saved."); return; } window.location.reload(); }
  async function remove() { setBusy(true); const url = kind === "hours" ? `/api/settings/business-hours/${value.weekday}` : kind === "availability" ? `/api/availability/${value.id}` : `/api/closures/${value.id}`; const response = await fetch(url, { method: "DELETE" }); const body = await response.json(); setBusy(false); if (!response.ok) { setError(body.error?.message ?? "Schedule block could not be deleted."); return; } window.location.reload(); }
  return <Dialog title={value.id || kind === "hours" ? "Edit schedule block" : "Add schedule block"} detail={kind === "hours" ? `This changes ${names[value.weekday]} studio hours every week.` : kind === "availability" ? `This availability repeats every ${names[value.weekday]}.` : "This closure applies only to the selected date."} onClose={onClose}><form className="operation-form" onSubmit={submit}>
    {!value.id && value.kind !== "hours" && <div className="segmented"><button type="button" className={kind === "availability" ? "active" : ""} onClick={() => setKind("availability")}>Staff availability</button><button type="button" className={kind === "closure" ? "active" : ""} onClick={() => setKind("closure")}>Dated closure</button></div>}
    {kind === "availability" && <label className="field">Staff<select name="staffId" defaultValue={value.staffId} required>{staff.filter((person) => person.active && person.role === "piercer").map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>}
    {kind === "closure" && <><label className="field">Date<input name="date" type="date" defaultValue={value.date} required/></label><label className="field">Reason<input name="reason" defaultValue={value.reason ?? ""}/></label></>}
    <div className="form-grid"><label className="field">Starts<input name="start" type="time" defaultValue={value.start} required/></label><label className="field">Ends<input name="end" type="time" defaultValue={value.end} required/></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}<footer>{(value.id || kind === "hours") && <button type="button" className="btn danger" disabled={busy} onClick={() => void remove()}>Delete block</button>}<button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save schedule"}</button></footer>
  </form></Dialog>;
}

function blockStyle(start: string, end: string) { const from = minutes(start), to = minutes(end); return { top: Math.max(0,(from-startHour*60)*hourHeight/60), height: Math.max(28,(to-from)*hourHeight/60) } as React.CSSProperties; }
function minutes(value: string) { const [h,m] = value.slice(0,5).split(":").map(Number); return h*60+m; }
function time(value: number) { return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`; }
function month(date: string) { return new Intl.DateTimeFormat("en-PH",{month:"short",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`)); }
function hourLabel(hour: number) { return new Intl.DateTimeFormat("en-PH",{hour:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(2020,0,1,hour))); }
function manilaTime(value: string) { return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"Asia/Manila"}).format(new Date(value)); }
