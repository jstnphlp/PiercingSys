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
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  canNavigateToNextBookingWeek,
  combinedServiceDuration,
  combinedServicePriceBounds,
  formatPhp,
  formatServicePrice,
  manilaDate,
  manilaWeekDates,
  servicePriceBounds,
  shiftManilaDate,
  type AvailableSlot,
  type PublicBookingResult,
  type Service,
} from "@/lib/domain";
import { CalendarGridSkeleton } from "@/app/app/staff-skeletons";
import {
  isIncompatibleServiceSelection,
  qualifiedPiercersForServices,
  toggleServiceSelection,
} from "./booking-selection";
import { removeOverlappingSlots } from "./booking-calendar";

type Props = {
  services: Service[];
  piercers: Array<{ id: string; name: string }>;
  assignments: Array<{ serviceId: string; staffId: string }>;
  minimumAge: number;
  bookingHorizonDays: number;
  preview?: boolean;
};
type ApiError = { error?: { message?: string } };

export function BookingForm({
  services,
  piercers,
  assignments,
  minimumAge,
  bookingHorizonDays,
  preview = false,
}: Props) {
  const minDate = manilaDate(new Date());
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
  const [serviceLimitReached, setServiceLimitReached] = useState(false);
  const [result, setResult] = useState<PublicBookingResult | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const selectedServices = useMemo(
    () => serviceIds
      .map((id) => displayServices.find((item) => item.id === id))
      .filter((item): item is Service => Boolean(item)),
    [serviceIds, displayServices],
  );
  const durationMinutes = combinedServiceDuration(selectedServices);
  const priceBounds = combinedServicePriceBounds(selectedServices);
  const selectedServicesHavePrices = selectedServices.every(
    (service) => servicePriceBounds(service) !== null,
  );
  const selectedPriceLabel = preview
    ? "Price TBD"
    : !selectedServices.length || !selectedServicesHavePrices
      ? "Price confirmed at studio"
      : priceBounds.min === priceBounds.max
        ? formatPhp(priceBounds.min)
        : `${formatPhp(priceBounds.min)}–${formatPhp(priceBounds.max)}`;
  const selectedPiercerName = piercerId
    ? piercers.find((person) => person.id === piercerId)?.name ?? "Selected piercer"
    : "Any qualified piercer";
  const eligiblePiercers = useMemo(
    () => qualifiedPiercersForServices(serviceIds, piercers, assignments),
    [assignments, piercers, serviceIds],
  );
  const incompatibleServices = isIncompatibleServiceSelection(serviceIds, piercers, assignments);
  const filteredServices = useMemo(() => displayServices.filter((service) =>
    service.category === serviceCategory &&
    `${service.name} ${service.description ?? ""} ${service.bodyArea ?? ""}`.toLowerCase().includes(serviceSearch.trim().toLowerCase()),
  ), [displayServices, serviceCategory, serviceSearch]);
  const visibleDates = useMemo(() => manilaWeekDates(date), [date]);
  const canNavigateNextWeek = canNavigateToNextBookingWeek(date, minDate, bookingHorizonDays);

  function toggleService(serviceId: string) {
    const next = toggleServiceSelection(serviceIds, serviceId);
    setServiceLimitReached(next.limitReached);
    if (next.serviceIds === serviceIds) return;
    setServiceIds(next.serviceIds);
    setSlot(null);
    if (piercerId && !next.serviceIds.every((id) =>
      assignments.some((item) => item.serviceId === id && item.staffId === piercerId)
    )) setPiercerId("");
  }

  async function loadSlots(
    nextServiceIds = serviceIds,
    nextDate = date,
    nextPiercerId = piercerId,
  ) {
    if (!nextServiceIds.length || !nextDate) return;
    if (isIncompatibleServiceSelection(nextServiceIds, piercers, assignments)) return;
    const dates = manilaWeekDates(nextDate);
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
      const query = new URLSearchParams({ from: dates[0], to: dates.at(-1)! });
      nextServiceIds.forEach((id) => query.append("serviceIds", id));
      if (nextPiercerId) query.set("piercerId", nextPiercerId);
      const response = await fetch(`/api/public/availability?${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setSlots((body.data as AvailableSlot[]) ?? []);
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
    form.set("idempotencyKey", idempotencyKey);
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
        setSlots((current) => removeOverlappingSlots(current, slot));
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
        <div className="booking-step booking-step-services">
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
            <div
              className={`selected-services ${selectedServices.length ? "has-selection" : "is-empty"}`}
              aria-live="polite"
            >
              <span className="selected-services-summary">
                <strong>
                  {selectedServices.length
                    ? `${selectedServices.length} selected`
                    : "None selected"}
                </strong>
                <small>
                  {selectedServices.length
                    ? `${durationMinutes} min · ${selectedPriceLabel}`
                    : "Pick a service"}
                </small>
              </span>
              <div className="selected-service-chips">
                {selectedServices.map((service) => (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    aria-label={`Remove ${service.name}`}
                  >
                    <span>
                      <strong>{service.name}</strong>
                      <small>
                        {preview ? "Price TBD" : formatServicePrice(service)} · {preview ? "Duration TBD" : `${service.durationMinutes} min`}
                      </small>
                    </span>
                    <b aria-hidden="true">×</b>
                  </button>
                ))}
              </div>
            </div>
            <div className="service-list compact" role="group" aria-label={`${serviceCategory} services`}>
              {filteredServices.map((service) => <button
                type="button" role="checkbox" aria-checked={serviceIds.includes(service.id)} key={service.id}
                className={serviceIds.includes(service.id) ? "selected" : ""}
                onClick={() => toggleService(service.id)}>
                <span className="service-radio">
                  {serviceIds.includes(service.id) && <Check size={12} aria-hidden="true" />}
                </span>
                <span><strong>{service.name}</strong><small>{service.bodyArea || service.description || "Piercing service"}</small></span>
                <span><strong>{preview ? "Price TBD" : formatServicePrice(service)}</strong><small>{preview ? "Duration TBD" : `${service.durationMinutes} min`}</small></span>
              </button>)}
              {!filteredServices.length && <p className="service-empty">No services match that search.</p>}
            </div>
          </div>
          {serviceLimitReached && (
            <p className="form-error service-selection-error" role="alert">
              You can select up to 12 services. Remove one to choose another.
            </p>
          )}
          {incompatibleServices && (
            <p className="form-error service-selection-error" role="alert">
              These services can’t be booked together because no piercer is qualified for all of them. Remove a service or book each service separately.
            </p>
          )}
          <button
            className="btn btn-primary next-button"
            disabled={!serviceIds.length || incompatibleServices}
            onClick={() => {
              if (incompatibleServices) return;
              setStep(2);
              void loadSlots();
            }}
          >
            {!serviceIds.length
              ? "Choose a service"
              : incompatibleServices
                ? "Adjust your selection"
                : <>Find an opening <ArrowRight size={16} /></>}
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
            <button type="button" aria-label="Previous week" disabled={shiftManilaDate(visibleDates.at(-1)!, -7) < minDate} onClick={() => { const next = shiftManilaDate(date, -7); setDate(next); void loadSlots(serviceIds, next, piercerId); }}><ChevronLeft/></button>
            <button type="button" onClick={() => { setDate(minDate); void loadSlots(serviceIds, minDate, piercerId); }}>Today</button>
            <button type="button" aria-label="Next week" disabled={!canNavigateNextWeek} onClick={() => { if (!canNavigateNextWeek) return; const next = shiftManilaDate(date, 7); setDate(next); void loadSlots(serviceIds, next, piercerId); }}><ChevronRight/></button>
            <strong>{formatWeekRange(visibleDates)}</strong>
            <label><span>Piercer</span><select value={piercerId} onChange={(event) => { const value = event.target.value; setPiercerId(value); void loadSlots(serviceIds, date, value); }}><option value="">Any qualified piercer</option>{eligiblePiercers.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
          </div>
          <div className="public-calendar-shell" aria-live="polite" aria-busy={loadingSlots}>
            {loadingSlots ? <><span className="sr-only" role="status">Calculating the week’s openings</span><div className="public-calendar-scroll"><CalendarGridSkeleton publicCalendar/></div></> : <div className="public-calendar-scroll"><div className="public-calendar-grid">
              <div className="public-calendar-corner"><CalendarDays/></div>
              {visibleDates.map((calendarDate) => <div key={calendarDate} className={`public-calendar-date ${calendarDate === minDate ? "today" : ""} ${calendarDate < minDate ? "past" : ""}`}><span>{formatWeekday(calendarDate)}</span><strong>{calendarDate.slice(8)}</strong><small>{formatMonth(calendarDate)}</small></div>)}
              <div className="public-calendar-times">{Array.from({ length: publicCalendarEndHour - publicCalendarStartHour + 1 }, (_, index) => <span key={index} style={{ top: index * publicCalendarHourHeight }}>{formatHour(publicCalendarStartHour + index)}</span>)}</div>
              {visibleDates.map((calendarDate) => <div className={`public-calendar-column ${calendarDate < minDate ? "past" : ""}`} key={calendarDate}>
                {slots.filter((item) => manilaSlotDate(item.startsAt) === calendarDate).map((item) => {
                  const isSelected = slot?.startsAt === item.startsAt;
                  return <button
                    type="button"
                    key={item.startsAt}
                    className={`public-slot ${isSelected ? "selected" : ""}`}
                    style={{ top: slotTop(item.startsAt) }}
                    aria-pressed={isSelected}
                    onClick={() => { setSlot(item); setDate(calendarDate); }}
                  >
                    {isSelected ? <Check /> : <Clock3 />}
                    <strong>{formatSlotTime(item.startsAt)}</strong>
                    <small>{isSelected ? "Selected" : "Available"}</small>
                  </button>;
                })}
              </div>)}
            </div></div>}
            {!loadingSlots && !slots.length && <div className="public-calendar-empty">No openings this week. Try the next week or another piercer.</div>}
          </div>
          {slot && (
            <div className="selected-slot-summary" role="status">
              <span><Check size={15} /></span>
              <div>
                <small>SELECTED OPENING</small>
                <strong>{formatAppointmentDate(slot.startsAt)}</strong>
              </div>
              <p>Choose another time above to change it.</p>
            </div>
          )}
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
              {slot ? <>Your details <ArrowRight size={16} /></> : "Choose an opening"}
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <form className="booking-step booking-step-details" onSubmit={submit}>
          <p className="eyebrow">STEP 3 OF 3</p>
          <h2>Review and confirm.</h2>
          <p>
            Check your appointment, then add your contact details to finish.
          </p>
          <div className="booking-details-layout">
            <section className="booking-review" aria-labelledby="booking-review-title">
              <header className="booking-review-header">
                <span><ShieldCheck size={19} /></span>
                <div>
                  <small>YOUR APPOINTMENT</small>
                  <h3 id="booking-review-title">Booking summary</h3>
                </div>
                <button type="button" onClick={() => setStep(2)}>Edit</button>
              </header>
              <ul className="booking-review-services" aria-label="Selected services">
                {selectedServices.map((service) => (
                  <li key={service.id}>
                    <span className="review-service-check"><Check size={12} /></span>
                    <span>
                      <strong>{service.name}</strong>
                      <small>{service.bodyArea || service.category} · {preview ? "Duration TBD" : `${service.durationMinutes} min`}</small>
                    </span>
                    <strong>{preview ? "Price TBD" : formatServicePrice(service)}</strong>
                  </li>
                ))}
              </ul>
              <dl className="booking-review-meta">
                <div>
                  <CalendarDays />
                  <dt>Schedule</dt>
                  <dd>{slot ? formatAppointmentDate(slot.startsAt) : "No opening selected"}</dd>
                </div>
                <div>
                  <Clock3 />
                  <dt>Duration</dt>
                  <dd>{preview ? "Duration TBD" : `${durationMinutes} minutes`}</dd>
                </div>
                <div>
                  <UserRound />
                  <dt>Piercer</dt>
                  <dd>{selectedPiercerName}</dd>
                </div>
              </dl>
              <div className="booking-review-total">
                <span>
                  <small>ESTIMATED TOTAL</small>
                  <strong>{selectedPriceLabel}</strong>
                </span>
                <small>
                  {preview
                    ? "Add real service prices in Settings."
                    : selectedServicesHavePrices
                      ? "Based on the selected services."
                      : "Final price is confirmed by the studio."}
                </small>
              </div>
            </section>
            <section className="customer-details" aria-labelledby="customer-details-title">
              <div className="customer-details-heading">
                <p className="eyebrow">YOUR DETAILS</p>
                <h3 id="customer-details-title">How can we reach you?</h3>
              </div>
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
            </section>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
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

function formatWeekRange(dates: string[]) {
  const format = (date: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return `${format(dates[0])}–${format(dates.at(-1)!)} `;
}
function formatWeekday(date: string) { return new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase(); }
function formatMonth(date: string) { return new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatHour(hour: number) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, hour))); }
function formatSlotTime(value: string) { return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatAppointmentDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
function manilaSlotDate(value: string) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function slotTop(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date(value)).split(":").map(Number);
  return Math.max(0, (parts[0] * 60 + parts[1] - publicCalendarStartHour * 60) * publicCalendarHourHeight / 60);
}
