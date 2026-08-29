"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  combinedServiceDuration,
  formatServicePrice,
  type AvailableSlot,
  type PublicBookingResult,
  type Service,
} from "@/lib/domain";

type Props = {
  services: Service[];
  piercers: Array<{ id: string; name: string }>;
  assignments: Array<{ serviceId: string; staffId: string }>;
  minimumAge: number;
  minDate: string;
  preview?: boolean;
};
type ApiError = { error?: { message?: string } };

export function BookingForm({
  services,
  piercers,
  assignments,
  minimumAge,
  minDate,
  preview = false,
}: Props) {
  const displayServices = useMemo<Service[]>(
    () =>
      services.length || !preview
        ? services
        : [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Your piercing service",
            description: "Preview card · add real services in Settings",
            bodyArea: null,
            category: "Ear Piercings",
            durationMinutes: 0,
            priceCents: 0,
            minPriceCents: null,
            maxPriceCents: null,
            priceUnit: null,
            isActive: true,
            },
          ],
    [preview, services],
  );
  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceCategory, setServiceCategory] = useState<Service["category"]>("Ear Piercings");
  const [serviceSearch, setServiceSearch] = useState("");
  const [piercerId, setPiercerId] = useState("");
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublicBookingResult | null>(null);
  const selectedServices = useMemo(
    () => serviceIds
      .map((id) => displayServices.find((item) => item.id === id))
      .filter((item): item is Service => Boolean(item)),
    [serviceIds, displayServices],
  );
  const durationMinutes = combinedServiceDuration(selectedServices);
  const eligiblePiercers = useMemo(
    () => piercers.filter((person) => serviceIds.every((serviceId) =>
      assignments.some((item) => item.serviceId === serviceId && item.staffId === person.id),
    )),
    [assignments, piercers, serviceIds],
  );
  const filteredServices = useMemo(() => displayServices.filter((service) =>
    service.category === serviceCategory &&
    `${service.name} ${service.description ?? ""} ${service.bodyArea ?? ""}`.toLowerCase().includes(serviceSearch.trim().toLowerCase()),
  ), [displayServices, serviceCategory, serviceSearch]);
  const visibleDates = useMemo(() => weekDates(date), [date]);

  async function loadSlots(
    nextServiceIds = serviceIds,
    nextDate = date,
    nextPiercerId = piercerId,
  ) {
    if (!nextServiceIds.length || !nextDate) return;
    const dates = weekDates(nextDate);
    setLoadingSlots(true);
    setSlot(null);
    setError("");
    if (preview) {
      const starts = ["10:00", "11:30", "13:00", "14:30", "16:00"];
      setSlots(
        dates.flatMap((previewDate, dayIndex) => dayIndex === 0 ? [] : starts.slice(0, 3 + dayIndex % 3).map((time) => {
          const start = new Date(`${previewDate}T${time}:00+08:00`);
          return {
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + Math.max(45, durationMinutes) * 60_000).toISOString(),
            piercerIds: [],
          };
        })),
      );
      setLoadingSlots(false);
      return;
    }
    try {
      const results = await Promise.all(dates.map(async (calendarDate) => {
        const query = new URLSearchParams({ date: calendarDate });
        nextServiceIds.forEach((id) => query.append("serviceIds", id));
        if (nextPiercerId) query.set("piercerId", nextPiercerId);
        const response = await fetch(`/api/public/availability?${query}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message);
        return body.data as AvailableSlot[];
      }));
      setSlots(results.flat());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Openings could not be loaded.",
      );
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;
    if (preview) {
      setResult({
        id: "preview",
        reference: "PREVIEW ONLY",
        status: "confirmed",
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    serviceIds.forEach((id) => form.append("serviceIds", id));
    form.set("startsAt", slot.startsAt);
    form.set("preferredPiercerId", piercerId);
    const response = await fetch("/api/public/bookings", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as {
      data?: PublicBookingResult;
    } & ApiError;
    setBusy(false);
    if (!response.ok || !body.data) {
      setError(body.error?.message ?? "We could not confirm your booking.");
      if (response.status === 409) {
        setStep(2);
        setSlots((current) =>
          current.filter((item) => item.startsAt !== slot.startsAt),
        );
        setSlot(null);
      }
      return;
    }
    setResult(body.data);
  }

  if (result)
    return (
      <div className="booking-success" role="status">
        <span>
          <Check />
        </span>
        <p className="eyebrow">{preview ? "PREVIEW COMPLETE" : "APPOINTMENT CONFIRMED"}</p>
        <h2>{preview ? "That’s the whole booking flow." : "Your corner is saved."}</h2>
        <p>
          {preview ? "No appointment was submitted. In the live system, this would reserve " : "We’ve reserved your appointment for "}
          <strong>
            {new Intl.DateTimeFormat("en-PH", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Asia/Manila",
            }).format(new Date(result.startsAt))}
          </strong>
          .
        </p>
        <div className="booking-reference">
          <small>{preview ? "DEVELOPMENT MODE" : "BOOKING REFERENCE"}</small>
          <strong>{result.reference}</strong>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => window.location.reload()}
        >
          Book another appointment
        </button>
      </div>
    );

  return (
    <div className="booking-form-wrap">
      {preview && (
        <div className="booking-preview-note" role="status">
          <Sparkles size={16} />
          <span><strong>Booking preview</strong><small>Explore the full flow now. Nothing will be submitted until Supabase and real studio details are configured.</small></span>
        </div>
      )}
      <ol className="booking-steps" aria-label="Booking progress">
        {["Service", "Schedule", "Details"].map((label, index) => (
          <li
            key={label}
            className={step >= index + 1 ? "active" : ""}
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      {step === 1 && (
        <div className="booking-step">
          <p className="eyebrow">STEP 1 OF 3</p>
          <h2>What are we piercing?</h2>
          <p>
            {preview ? "This placeholder shows how your configured services will look." : "Prices are in Philippine pesos and reflect the configured studio rate."}
          </p>
          <div className="service-browser">
            <div className="service-tools">
              <label><Search size={15}/><input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search services" aria-label="Search services"/></label>
              <div className="service-tabs" aria-label="Service category">
                {(["Ear Piercings", "Face & Body Piercings", "Other Services"] as Service["category"][]).map((category) => <button type="button" key={category} className={serviceCategory === category ? "active" : ""} aria-pressed={serviceCategory === category} onClick={() => setServiceCategory(category)}>{category.replace(" Piercings", "")}</button>)}
              </div>
            </div>
            {selectedServices.length > 0 && <div className="selected-services" aria-live="polite"><span><strong>{selectedServices.length} selected</strong><small>{durationMinutes} minutes total</small></span>{selectedServices.map((service) => <button type="button" key={service.id} onClick={() => { setServiceIds(serviceIds.filter((id) => id !== service.id)); setSlot(null); }} aria-label={`Remove ${service.name}`}>{service.name} <b>×</b></button>)}</div>}
            <div className="service-list compact" role="group" aria-label={`${serviceCategory} services`}>
              {filteredServices.map((service) => <button
                type="button" role="checkbox" aria-checked={serviceIds.includes(service.id)} key={service.id}
                className={serviceIds.includes(service.id) ? "selected" : ""}
                onClick={() => {
                  const next = serviceIds.includes(service.id) ? serviceIds.filter((id) => id !== service.id) : [...serviceIds, service.id];
                  setServiceIds(next); setSlot(null);
                  if (piercerId && !next.every((serviceId) => assignments.some((item) => item.serviceId === serviceId && item.staffId === piercerId))) setPiercerId("");
                }}>
                <span className="service-radio">{serviceIds.includes(service.id) && <i />}</span>
                <span><strong>{service.name}</strong><small>{service.bodyArea || service.description || "Piercing service"}</small></span>
                <span><strong>{preview ? "Price TBD" : formatServicePrice(service)}</strong><small>{preview ? "Duration TBD" : `${service.durationMinutes} min`}</small></span>
              </button>)}
              {!filteredServices.length && <p className="service-empty">No services match that search.</p>}
            </div>
          </div>
          <button
            className="btn btn-primary next-button"
            disabled={!serviceIds.length}
            onClick={() => {
              setStep(2);
              void loadSlots();
            }}
          >
            Find an opening <ArrowRight size={16} />
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="booking-step">
          <p className="eyebrow">STEP 2 OF 3</p>
          <h2>Pick your moment.</h2>
          <p>
            {selectedServices.map((service) => service.name).join(" + ")} {preview ? "· preview openings" : `· ${durationMinutes} minutes total`}
          </p>
          <div className="public-calendar-toolbar">
            <button type="button" aria-label="Previous week" disabled={shiftDate(visibleDates.at(-1)!, -7) < minDate} onClick={() => { const next = shiftDate(date, -7); setDate(next); void loadSlots(serviceIds, next, piercerId); }}><ChevronLeft/></button>
            <button type="button" onClick={() => { setDate(minDate); void loadSlots(serviceIds, minDate, piercerId); }}>Today</button>
            <button type="button" aria-label="Next week" onClick={() => { const next = shiftDate(date, 7); setDate(next); void loadSlots(serviceIds, next, piercerId); }}><ChevronRight/></button>
            <strong>{formatWeekRange(visibleDates)}</strong>
            <label><span>Piercer</span><select value={piercerId} onChange={(event) => { const value = event.target.value; setPiercerId(value); void loadSlots(serviceIds, date, value); }}><option value="">Any qualified piercer</option>{eligiblePiercers.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
          </div>
          <div className="public-calendar-shell" aria-live="polite" aria-busy={loadingSlots}>
            <div className="public-calendar-scroll"><div className="public-calendar-grid">
              <div className="public-calendar-corner"><CalendarDays/></div>
              {visibleDates.map((calendarDate) => <div key={calendarDate} className={`public-calendar-date ${calendarDate === minDate ? "today" : ""} ${calendarDate < minDate ? "past" : ""}`}><span>{formatWeekday(calendarDate)}</span><strong>{calendarDate.slice(8)}</strong><small>{formatMonth(calendarDate)}</small></div>)}
              <div className="public-calendar-times">{Array.from({ length: publicCalendarEndHour - publicCalendarStartHour + 1 }, (_, index) => <span key={index} style={{ top: index * publicCalendarHourHeight }}>{formatHour(publicCalendarStartHour + index)}</span>)}</div>
              {visibleDates.map((calendarDate) => <div className={`public-calendar-column ${calendarDate < minDate ? "past" : ""}`} key={calendarDate}>
                {slots.filter((item) => manilaSlotDate(item.startsAt) === calendarDate).map((item) => <button type="button" key={item.startsAt} className={`public-slot ${slot?.startsAt === item.startsAt ? "selected" : ""}`} style={{ top: slotTop(item.startsAt) }} onClick={() => { setSlot(item); setDate(calendarDate); }}><Clock3/><strong>{formatSlotTime(item.startsAt)}</strong><small>Available</small></button>)}
              </div>)}
            </div></div>
            {loadingSlots && <div className="public-calendar-loading"><Sparkles className="spin"/> Calculating the week’s openings…</div>}
            {!loadingSlots && !slots.length && <div className="public-calendar-empty">No openings this week. Try the next week or another piercer.</div>}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary"
              disabled={!slot}
              onClick={() => setStep(3)}
            >
              Your details <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <form className="booking-step" onSubmit={submit}>
          <p className="eyebrow">STEP 3 OF 3</p>
          <h2>Tell us about you.</h2>
          <p>
            Your selected opening stays available until the booking is
            submitted.
          </p>
          <div className="detail-grid">
            <label className="field">
              First name
              <input
                name="firstName"
                required
                maxLength={80}
                autoComplete="given-name"
              />
            </label>
            <label className="field">
              Last name
              <input
                name="lastName"
                required
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
            <label className="field">
              Email
              <input
                name="email"
                required
                type="email"
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label className="field">
              Mobile number
              <input
                name="phone"
                required
                type="tel"
                maxLength={30}
                autoComplete="tel"
              />
            </label>
          </div>
          <label className="field notes-field">
            Notes (optional)
            <textarea
              name="notes"
              maxLength={2000}
              placeholder="Placement ideas, allergies, access needs, or questions"
            />
          </label>
          <label className="upload-field">
            <Upload size={18} />
            <span>
              <strong>Reference photo (optional)</strong>
              <small>JPG or PNG · up to 5 MB</small>
            </span>
            <input name="photo" type="file" accept="image/jpeg,image/png" />
          </label>
          <label className="check-field">
            <input name="ageConfirmed" type="checkbox" required />
            <span>
              <Check size={12} />
            </span>
            I confirm that I am at least {minimumAge} years old.
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="selection-summary">
            <ShieldCheck size={16} />
            <span>
              <strong>{selectedServices.map((service) => service.name).join(" + ")}</strong>
              <small>
                {slot &&
                  new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(slot.startsAt))}
              </small>
            </span>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Confirming…" : "Confirm appointment"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const publicCalendarStartHour = 8;
const publicCalendarEndHour = 21;
const publicCalendarHourHeight = 56;

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function weekday(date: string) { return new Date(`${date}T12:00:00Z`).getUTCDay(); }
function weekDates(anchor: string) {
  const sunday = shiftDate(anchor, -weekday(anchor));
  return Array.from({ length: 7 }, (_, index) => shiftDate(sunday, index));
}
function formatWeekRange(dates: string[]) {
  const format = (date: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return `${format(dates[0])}–${format(dates.at(-1)!)} `;
}
function formatWeekday(date: string) { return new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase(); }
function formatMonth(date: string) { return new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatHour(hour: number) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, hour))); }
function formatSlotTime(value: string) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function manilaSlotDate(value: string) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function slotTop(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date(value)).split(":").map(Number);
  return Math.max(0, (parts[0] * 60 + parts[1] - publicCalendarStartHour * 60) * publicCalendarHourHeight / 60);
}
