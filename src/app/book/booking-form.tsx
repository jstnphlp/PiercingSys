"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatServicePrice,
  type AvailableSlot,
  type PublicBookingResult,
  type Service,
} from "@/lib/domain";

type Props = {
  services: Service[];
  piercers: Array<{ id: string; name: string }>;
  minimumAge: number;
  minDate: string;
  preview?: boolean;
};
type ApiError = { error?: { message?: string } };

export function BookingForm({
  services,
  piercers,
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
  const [serviceId, setServiceId] = useState("");
  const [piercerId, setPiercerId] = useState("");
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PublicBookingResult | null>(null);
  const selectedService = useMemo(
    () => displayServices.find((item) => item.id === serviceId),
    [serviceId, displayServices],
  );

  async function loadSlots(
    nextServiceId = serviceId,
    nextDate = date,
    nextPiercerId = piercerId,
  ) {
    if (!nextServiceId || !nextDate) return;
    setLoadingSlots(true);
    setSlot(null);
    setError("");
    if (preview) {
      const starts = ["10:00", "11:30", "13:00", "14:30", "16:00"];
      setSlots(
        starts.map((time) => {
          const start = new Date(`${nextDate}T${time}:00+08:00`);
          return {
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + 45 * 60_000).toISOString(),
            piercerIds: [],
          };
        }),
      );
      setLoadingSlots(false);
      return;
    }
    const query = new URLSearchParams({
      serviceId: nextServiceId,
      date: nextDate,
    });
    if (nextPiercerId) query.set("piercerId", nextPiercerId);
    try {
      const response = await fetch(`/api/public/availability?${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      setSlots(body.data as AvailableSlot[]);
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
    form.set("serviceId", serviceId);
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
          <div className="service-list" role="radiogroup" aria-label="Services">
            {[
              "Ear Piercings",
              "Face & Body Piercings",
              "Other Services",
            ].map((category) => {
              const categoryServices = displayServices.filter(
                (service) => service.category === category,
              );
              if (!categoryServices.length) return null;
              return (
                <section className="service-category" key={category}>
                  <h3>{category}</h3>
                  {categoryServices.map((service) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={service.id === serviceId}
                      key={service.id}
                      className={service.id === serviceId ? "selected" : ""}
                      onClick={() => setServiceId(service.id)}
                    >
                      <span className="service-radio">
                        {service.id === serviceId && <i />}
                      </span>
                      <span>
                        <strong>{service.name}</strong>
                        <small>
                          {service.description ||
                            service.bodyArea ||
                            "Piercing service"}
                        </small>
                      </span>
                      <span>
                        <strong>
                          {preview ? "Price TBD" : formatServicePrice(service)}
                        </strong>
                        <small>
                          {preview
                            ? "Duration TBD"
                            : `${service.durationMinutes} min`}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
          <button
            className="btn btn-primary next-button"
            disabled={!serviceId}
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
            {selectedService?.name} {preview ? "· preview openings" : `· ${selectedService?.durationMinutes} minutes`}
          </p>
          <div className="schedule-fields">
            <label className="field">
              Date
              <span className="icon-field">
                <CalendarDays size={16} />
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDate(value);
                    void loadSlots(serviceId, value, piercerId);
                  }}
                />
              </span>
            </label>
            <label className="field">
              Piercer preference
              <select
                value={piercerId}
                onChange={(event) => {
                  const value = event.target.value;
                  setPiercerId(value);
                  void loadSlots(serviceId, date, value);
                }}
              >
                <option value="">Any qualified piercer</option>
                {piercers.map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="slot-region" aria-live="polite">
            {loadingSlots ? (
              <div className="slot-message">
                <Sparkles className="spin" /> Calculating openings…
              </div>
            ) : slots.length ? (
              <div className="slot-grid">
                {slots.map((item) => (
                  <button
                    type="button"
                    key={item.startsAt}
                    className={
                      slot?.startsAt === item.startsAt ? "selected" : ""
                    }
                    onClick={() => setSlot(item)}
                  >
                    <Clock3 size={14} />
                    {new Intl.DateTimeFormat("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Asia/Manila",
                    }).format(new Date(item.startsAt))}
                  </button>
                ))}
              </div>
            ) : (
              <div className="slot-message">
                {preview ? "Choose a service to see preview openings." : "No openings on this date. Try another day or piercer."}
              </div>
            )}
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
              <strong>{selectedService?.name}</strong>
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
