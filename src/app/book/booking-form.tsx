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
  canNavigateToNextBookingWeek,
  combinedServiceDuration,
  formatServicePrice,
  manilaDate,
  manilaWeekDates,
  shiftManilaDate,
  type AvailableSlot,
  type PublicBookingResult,
  type Service,
} from "@/lib/domain";
import { CalendarGridSkeleton } from "@/app/app/staff-skeletons";
import { eyebrow, field, hippyButton } from "@/components/ui/studio-styles";
import { cn } from "@/lib/utils";
import {
  isIncompatibleServiceSelection,
  qualifiedPiercersForServices,
  toggleServiceSelection,
} from "./booking-selection";
import {
  bookingFormWrap,
  bookingHeading,
  bookingStepBubble,
  bookingStepItem,
  bookingSteps,
  publicCalendarGrid,
  publicCalendarHead,
  publicCalendarToolbar,
  serviceButton,
} from "./booking-styles";

const bookingError = "rounded-[10px] border-2 border-hippy-ink bg-[#f6d6c0] px-[13px] py-[11px] text-xs/[1.5] text-[#8d2d23] shadow-[2px_2px_0_#3b2923]";
const bookingField = `${field} text-[#5e473e] [&_input]:rounded-[12px_9px_13px_10px] [&_input]:border-2 [&_input]:border-hippy-ink [&_input]:bg-[#fffaf0] [&_input]:shadow-[2px_2px_0_#3b2923] [&_select]:rounded-[12px_9px_13px_10px] [&_select]:border-2 [&_select]:border-hippy-ink [&_select]:bg-[#fffaf0] [&_select]:shadow-[2px_2px_0_#3b2923] [&_textarea]:rounded-[12px_9px_13px_10px] [&_textarea]:border-2 [&_textarea]:border-hippy-ink [&_textarea]:bg-[#fffaf0] [&_textarea]:shadow-[2px_2px_0_#3b2923]`;

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
      <div className="m-auto w-[min(430px,88%)] text-center [&>p:not(.eyebrow)]:text-xs/[1.65] [&>p:not(.eyebrow)]:text-[#71594f]" role="status">
        <span className="mx-auto mb-[18px] grid size-[61px] place-items-center rounded-[50%_43%_54%_46%] border-2 border-hippy-ink bg-hippy-orange text-white shadow-[4px_4px_0_#3b2923]">
          <Check />
        </span>
        <p className={`${eyebrow} text-hippy-rust`}>{preview ? "PREVIEW COMPLETE" : "APPOINTMENT CONFIRMED"}</p>
        <h2 className={bookingHeading}>{preview ? "That’s the whole booking flow." : "Your corner is saved."}</h2>
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
        <div className="my-[22px] flex flex-col gap-1.5 rounded-[13px] border-2 border-dashed border-hippy-ink bg-[#f2c273] p-[15px]">
          <small className="text-[8px] tracking-[1.4px] text-[#725449]">{preview ? "DEVELOPMENT MODE" : "BOOKING REFERENCE"}</small>
          <strong className="text-lg tracking-[1px] text-[#913d25]">{result.reference}</strong>
        </div>
        <button
          className={hippyButton({ variant: "secondary" })}
          onClick={() => window.location.reload()}
        >
          Book another appointment
        </button>
      </div>
    );

  return (
    <div className={bookingFormWrap}>
      {preview && (
        <div className="mb-[19px] flex -rotate-[.4deg] items-center gap-2.5 rounded-[13px_18px_12px_16px] border-2 border-dashed border-hippy-ink bg-[#dce8d3] px-3 py-2.5 text-hippy-ink [&>span]:flex [&>span]:flex-col [&>span]:gap-0.5 [&_strong]:text-[10px] [&_small]:text-[8px]/[1.45] [&_small]:text-[#5f5147]" role="status">
          <Sparkles size={16} />
          <span><strong>Booking preview</strong><small>Explore the full flow now. Nothing will be submitted until Supabase and real studio details are configured.</small></span>
        </div>
      )}
      <ol className={bookingSteps} aria-label="Booking progress">
        {["Service", "Schedule", "Details"].map((label, index) => (
          <li
            key={label}
            className={cn(bookingStepItem, step >= index + 1 && "font-[850] text-hippy-rust")}
            aria-current={step === index + 1 ? "step" : undefined}
          >
            <span className={cn(bookingStepBubble, step >= index + 1 && "bg-hippy-orange text-white")}>{step > index + 1 ? <Check size={13} /> : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      {step === 1 && (
        <div>
          <p className={`${eyebrow} text-hippy-rust`}>STEP 1 OF 3</p>
          <h2 className={bookingHeading}>What are we piercing?</h2>
          <p className="mt-2 mb-[22px] text-[11px] text-[#765d53]">
            {preview ? "This placeholder shows how your configured services will look." : "Prices are in Philippine pesos and reflect the configured studio rate."}
          </p>
          <div className="overflow-hidden rounded-[18px_13px_20px_15px] border-2 border-hippy-ink bg-[#f7dfae] shadow-[3px_3px_0_#3b2923]">
            <div className="border-b border-dashed border-[#ad6b4c] p-[11px]">
              <label className="flex h-[39px] items-center gap-2 rounded-[10px] border-[1.5px] border-hippy-ink bg-[#fffaf0] px-2.5 [&>svg]:text-hippy-rust [&>input]:min-w-0 [&>input]:flex-1 [&>input]:border-0 [&>input]:bg-transparent [&>input]:text-[10px] [&>input]:outline-none"><Search size={15}/><input value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Search services" aria-label="Search services"/></label>
              <div className="mt-[9px] flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Service category">
                {(["Ear Piercings", "Face & Body Piercings", "Other Services"] as Service["category"][]).map((category) => <button type="button" key={category} className={cn("min-w-max rounded-[9px] border border-hippy-ink bg-[#fff5dc] px-2.5 py-[7px] text-[9px] font-[850] text-[#735044] shadow-[1px_1px_0_#3b2923]", serviceCategory === category && "bg-hippy-orange text-white")} aria-pressed={serviceCategory === category} onClick={() => setServiceCategory(category)}>{category.replace(" Piercings", "")}</button>)}
              </div>
            </div>
            {selectedServices.length > 0 && <div className="flex items-center gap-1.5 overflow-x-auto border-b border-dashed border-[#ad6b4c] bg-[#dbe7d2] px-[11px] py-[9px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>span]:mr-[3px] [&>span]:flex [&>span]:min-w-max [&>span]:flex-col [&>span_>strong]:text-[9px] [&>span_>small]:text-[8px] [&>span_>small]:text-[#6d564c] [&>button]:min-w-max [&>button]:rounded-full [&>button]:border [&>button]:border-hippy-ink [&>button]:bg-[#fffaf0] [&>button]:px-2 [&>button]:py-[5px] [&>button]:text-[8px] [&>button]:font-extrabold [&>button]:shadow-[1px_1px_0_#3b2923] [&_b]:ml-[3px] [&_b]:text-hippy-rust" aria-live="polite"><span><strong>{selectedServices.length} selected</strong><small>{durationMinutes} minutes total</small></span>{selectedServices.map((service) => <button type="button" key={service.id} onClick={() => toggleService(service.id)} aria-label={`Remove ${service.name}`}>{service.name} <b>×</b></button>)}</div>}
            <div className="grid max-h-[345px] grid-cols-2 content-start gap-2 overflow-y-auto p-2.5 [scrollbar-color:#df682c_#efd09b] [scrollbar-width:thin] max-[630px]:max-h-[390px] max-[630px]:grid-cols-1" role="group" aria-label={`${serviceCategory} services`}>
              {filteredServices.map((service) => <button
                type="button" role="checkbox" aria-checked={serviceIds.includes(service.id)} key={service.id}
                className={cn(serviceButton, serviceIds.includes(service.id) && "-translate-px -rotate-[.25deg] bg-[#f2c273] shadow-[3px_3px_0_#3b2923]")}
                onClick={() => toggleService(service.id)}>
                <span className="grid size-[17px] place-items-center rounded-full border-2 border-hippy-ink bg-white">{serviceIds.includes(service.id) && <i className="size-2 rounded-full bg-hippy-orange" />}</span>
                <span><strong>{service.name}</strong><small>{service.bodyArea || service.description || "Piercing service"}</small></span>
                <span><strong>{preview ? "Price TBD" : formatServicePrice(service)}</strong><small>{preview ? "Duration TBD" : `${service.durationMinutes} min`}</small></span>
              </button>)}
              {!filteredServices.length && <p className="col-span-full m-[22px] text-center text-[10px] text-[#76594d]">No services match that search.</p>}
            </div>
          </div>
          {serviceLimitReached && (
            <p className={`${bookingError} mt-3.5 text-[10px] font-[750]`} role="alert">
              You can select up to 12 services. Remove one to choose another.
            </p>
          )}
          {incompatibleServices && (
            <p className={`${bookingError} mt-3.5 text-[10px] font-[750]`} role="alert">
              These services can’t be booked together because no piercer is qualified for all of them. Remove a service or book each service separately.
            </p>
          )}
          <button
            className={`${hippyButton({ variant: "primary" })} mt-[22px] ml-auto flex`}
            disabled={!serviceIds.length || incompatibleServices}
            onClick={() => {
              if (incompatibleServices) return;
              setStep(2);
              void loadSlots();
            }}
          >
            Find an opening <ArrowRight size={16} />
          </button>
        </div>
      )}
      {step === 2 && (
        <div>
          <p className={`${eyebrow} text-hippy-rust`}>STEP 2 OF 3</p>
          <h2 className={bookingHeading}>Pick your moment.</h2>
          <p className="mt-2 mb-[22px] text-[11px] text-[#765d53]">
            {selectedServices.map((service) => service.name).join(" + ")} {preview ? "· preview openings" : `· ${durationMinutes} minutes total`}
          </p>
          <div className={publicCalendarToolbar}>
            <button type="button" aria-label="Previous week" disabled={shiftManilaDate(visibleDates.at(-1)!, -7) < minDate} onClick={() => { const next = shiftManilaDate(date, -7); setDate(next); void loadSlots(serviceIds, next, piercerId); }}><ChevronLeft/></button>
            <button type="button" onClick={() => { setDate(minDate); void loadSlots(serviceIds, minDate, piercerId); }}>Today</button>
            <button type="button" aria-label="Next week" disabled={!canNavigateNextWeek} onClick={() => { if (!canNavigateNextWeek) return; const next = shiftManilaDate(date, 7); setDate(next); void loadSlots(serviceIds, next, piercerId); }}><ChevronRight/></button>
            <strong>{formatWeekRange(visibleDates)}</strong>
            <label><span>Piercer</span><select value={piercerId} onChange={(event) => { const value = event.target.value; setPiercerId(value); void loadSlots(serviceIds, date, value); }}><option value="">Any qualified piercer</option>{eligiblePiercers.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
          </div>
          <div className="relative mt-[11px] overflow-hidden rounded-[17px_12px_19px_14px] border-2 border-hippy-ink bg-[#fff8e7] shadow-[3px_3px_0_#3b2923]" aria-live="polite" aria-busy={loadingSlots}>
            {loadingSlots ? <><span className="sr-only" role="status">Calculating the week’s openings</span><div className="max-h-[520px] overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[630px]:max-h-[65vh]"><CalendarGridSkeleton publicCalendar/></div></> : <div className="max-h-[520px] overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[630px]:max-h-[65vh]"><div className={publicCalendarGrid}>
              <div className={`${publicCalendarHead} [&>svg]:w-4 [&>svg]:text-hippy-rust`}><CalendarDays/></div>
              {visibleDates.map((calendarDate) => <div key={calendarDate} className={cn(publicCalendarHead, "flex-col border-l border-l-[#c68f6d] [&>span]:text-[7px] [&>span]:text-[#775b50] [&>small]:text-[7px] [&>small]:text-[#775b50] [&>strong]:font-display [&>strong]:text-base [&>strong]:font-extrabold", calendarDate === minDate && "bg-hippy-orange text-white [&>span]:text-white [&>small]:text-white", calendarDate < minDate && "opacity-52")}><span>{formatWeekday(calendarDate)}</span><strong>{calendarDate.slice(8)}</strong><small>{formatMonth(calendarDate)}</small></div>)}
              <div className="relative z-2 border-r-[1.5px] border-hippy-ink bg-[#f5dfb5]">{Array.from({ length: publicCalendarEndHour - publicCalendarStartHour + 1 }, (_, index) => <span className="absolute right-[7px] -translate-y-[5px] text-[7px] text-[#81695e]" key={index} style={{ top: index * publicCalendarHourHeight }}>{formatHour(publicCalendarStartHour + index)}</span>)}</div>
              {visibleDates.map((calendarDate) => <div className={cn("relative border-l border-[#cf9d7d] bg-[#fffaf0] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,#e7cfab_28px,transparent_29px,transparent_55px,#cfa17e_56px)]", calendarDate < minDate && "bg-[#eee1ca]")} key={calendarDate}>
                {slots.filter((item) => manilaSlotDate(item.startsAt) === calendarDate).map((item) => <button type="button" key={item.startsAt} className={cn("absolute right-1 left-1 z-2 grid h-[27px] cursor-pointer grid-cols-[13px_1fr] grid-rows-2 items-center rounded-[7px] border border-hippy-ink border-l-4 border-l-[#538679] bg-[#d9ead7] px-[5px] py-0.5 text-left text-[#315343] shadow-[1px_1px_0_#3b2923] hover:z-4 hover:-translate-px hover:border-l-white hover:bg-hippy-orange hover:text-white hover:shadow-[3px_3px_0_#3b2923] focus-visible:z-4 focus-visible:-translate-px focus-visible:border-l-white focus-visible:bg-hippy-orange focus-visible:text-white focus-visible:shadow-[3px_3px_0_#3b2923] [&>svg]:row-span-2 [&>svg]:w-[11px] [&>strong]:text-[7px]/none [&>small]:text-[6px]/none", slot?.startsAt === item.startsAt && "z-4 -translate-px border-l-white bg-hippy-orange text-white shadow-[3px_3px_0_#3b2923]")} style={{ top: slotTop(item.startsAt) }} onClick={() => { setSlot(item); setDate(calendarDate); }}><Clock3/><strong>{formatSlotTime(item.startsAt)}</strong><small>Available</small></button>)}
              </div>)}
            </div></div>}
            {!loadingSlots && !slots.length && <div className="absolute right-3.5 bottom-3.5 left-3.5 z-7 flex items-center justify-center gap-2 rounded-[9px] border border-dashed border-hippy-ink bg-[#f5d2ae] p-[9px] text-center text-[10px] font-extrabold text-[#6b4b40]">No openings this week. Try the next week or another piercer.</div>}
          </div>
          {error && (
            <p className={bookingError} role="alert">
              {error}
            </p>
          )}
          <div className="mt-[22px] flex justify-between gap-3 max-[630px]:[&_button]:px-[13px]">
            <button className={hippyButton({ variant: "secondary" })} onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className={hippyButton({ variant: "primary" })}
              disabled={!slot}
              onClick={() => setStep(3)}
            >
              Your details <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <form onSubmit={submit}>
          <p className={`${eyebrow} text-hippy-rust`}>STEP 3 OF 3</p>
          <h2 className={bookingHeading}>Tell us about you.</h2>
          <p className="mt-2 mb-[22px] text-[11px] text-[#765d53]">
            We’ll check that your selected opening is still available when you
            confirm your appointment.
          </p>
          <div className="grid grid-cols-2 gap-[13px] max-[630px]:grid-cols-1">
            <label className={bookingField}>
              First name
              <input
                name="firstName"
                required
                maxLength={80}
                autoComplete="given-name"
              />
            </label>
            <label className={bookingField}>
              Last name
              <input
                name="lastName"
                required
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
            <label className={bookingField}>
              Email
              <input
                name="email"
                required
                type="email"
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label className={bookingField}>
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
          <label className={`${bookingField} mt-[13px]`}>
            Notes (optional)
            <textarea
              name="notes"
              maxLength={2000}
              placeholder="Placement ideas, allergies, access needs, or questions"
            />
          </label>
          <label className="relative mt-[13px] flex min-h-[57px] cursor-pointer items-center gap-[11px] rounded-[13px_10px_14px_11px] border-2 border-dashed border-hippy-ink bg-[#f8dcbb] px-3 py-[9px] text-[#a84427] [&>span]:flex [&>span]:flex-col [&>span]:gap-[3px] [&_strong]:text-[10px] [&_small]:text-[8px] [&_small]:text-[#7d6054] [&_input]:absolute [&_input]:inset-0 [&_input]:cursor-pointer [&_input]:opacity-0">
            <Upload size={18} />
            <span>
              <strong>Reference photo (optional)</strong>
              <small>JPG or PNG · up to 5 MB</small>
            </span>
            <input name="photo" type="file" accept="image/jpeg,image/png" />
          </label>
          <label className="relative mt-[13px] flex cursor-pointer items-center gap-2 text-[9px] text-[#71594f]">
            <input className="peer absolute opacity-0" name="ageConfirmed" type="checkbox" required />
            <span className="grid size-[18px] place-items-center rounded-[5px] border-2 border-hippy-ink bg-white text-transparent peer-checked:bg-hippy-orange peer-checked:text-white">
              <Check size={12} />
            </span>
            I confirm that I am at least {minimumAge} years old.
          </label>
          {error && (
            <p className={bookingError} role="alert">
              {error}
            </p>
          )}
          <div className="mt-[15px] flex items-center gap-2.5 rounded-[14px_10px_15px_11px] border-2 border-hippy-ink bg-[#f2c273] px-[13px] py-[11px] text-[#7f391f] shadow-[2px_2px_0_#3b2923] [&>span]:flex [&>span]:flex-col [&>span]:gap-[3px] [&_strong]:text-[10px] [&_small]:text-[8px] [&_small]:text-[#6d5045]">
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
          <div className="mt-[22px] flex justify-between gap-3 max-[630px]:[&_button]:px-[13px]">
            <button
              type="button"
              className={hippyButton({ variant: "secondary" })}
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button className={hippyButton({ variant: "primary" })} disabled={busy}>
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
function manilaSlotDate(value: string) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
function slotTop(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date(value)).split(":").map(Number);
  return Math.max(0, (parts[0] * 60 + parts[1] - publicCalendarStartHour * 60) * publicCalendarHourHeight / 60);
}
