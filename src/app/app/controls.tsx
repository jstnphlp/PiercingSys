"use client";

import { Check, LoaderCircle, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StudioSelect } from "@/components/ui/studio-select";
import { toast } from "@/components/ui/toast";
import {
  formatServicePrice,
  servicePriceBounds,
  type BookingStatus,
  type Service,
  type StaffRole,
  type StudioSettings,
} from "@/lib/domain";
import type { SaleRecord, StaffRecord } from "@/lib/data/staff";
import { CustomerSelect } from "./customer-select";
import { requestWorkspaceRefresh } from "./workspace-refresh";
import { dashButton, dashError, dashField, inlineForm, operationDialog, operationForm, operationGrid, panelHead, settingSection, settingsListRow } from "./dashboard-styles";

function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(url: string, options: RequestInit) {
    setBusy(true);
    setError("");
    const response = await fetch(url, options);
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error?.message ?? "The change could not be saved.");
      return false;
    }
    return true;
  }
  function reset() {
    setError("");
  }
  return { busy, error, run, reset };
}

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

export function BookingActions({
  id,
  status,
  canManage,
  startsAt,
}: {
  id: string;
  status: BookingStatus;
  canManage: boolean;
  startsAt: string;
}) {
  const mutation = useMutation();
  const [rescheduling, setRescheduling] = useState(false);
  useEffect(() => {
    if (!rescheduling) return;
    function close(event: KeyboardEvent) { if (event.key === "Escape") setRescheduling(false); }
    document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close);
  }, [rescheduling]);
  async function change(next: BookingStatus) {
    if (
      await mutation.run(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
    )
      requestWorkspaceRefresh();
  }
  async function reschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = `${form.get("date")}T${form.get("time")}:00+08:00`;
    if (
      await mutation.run(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startsAt }),
      })
    )
      requestWorkspaceRefresh();
  }
  return (
    <div className="relative flex flex-wrap gap-1 [&>button]:cursor-pointer [&>button]:rounded-[7px] [&>button]:border [&>button]:border-hippy-ink [&>button]:bg-[#fff7e3] [&>button]:px-[7px] [&>button]:py-[5px] [&>button]:text-[8px] [&>button]:font-extrabold [&>button]:text-[#70402e] [&>button]:shadow-[1px_1px_0_#3b2923] [&>button:hover]:bg-[#f6d19c] [&>small]:absolute [&>small]:top-full [&>small]:right-0 [&>small]:w-[150px] [&>small]:text-[7px] [&>small]:text-danger">
      {status === "requested" && canManage && (
        <>
          <button disabled={mutation.busy} onClick={() => change("confirmed")}>
            Confirm
          </button>
          <button disabled={mutation.busy} onClick={() => change("rejected")}>
            Reject
          </button>
          <button
            className="text-danger!"
            disabled={mutation.busy}
            onClick={() => change("cancelled")}
          >
            Cancel
          </button>
        </>
      )}
      {status === "confirmed" && (
        <>
          <button disabled={mutation.busy} onClick={() => change("completed")}>
            Complete
          </button>
          <button disabled={mutation.busy} onClick={() => change("no_show")}>
            No-show
          </button>
          <button
            disabled={mutation.busy}
            onClick={() => setRescheduling(true)}
          >
            Reschedule
          </button>
          <button
            className="text-danger!"
            disabled={mutation.busy}
            onClick={() => change("cancelled")}
          >
            Cancel
          </button>
        </>
      )}
      {rescheduling && (
        <div className="fixed inset-0 z-90" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRescheduling(false); }}>
        <form className="absolute top-[calc(100%+6px)] right-0 z-91 grid w-[220px] grid-cols-2 gap-1.5 rounded-[10px] border-2 border-hippy-ink bg-[#fff4dc] p-2.5 shadow-[5px_5px_0_#3b2923] [&>strong]:col-span-2 [&>strong]:text-[9px] [&>input]:h-[31px] [&>input]:min-w-0 [&>input]:rounded-md [&>input]:border [&>input]:border-studio-line [&>input]:p-1 [&>input]:text-[8px]" role="dialog" aria-modal="true" aria-label="Reschedule appointment" onSubmit={reschedule}>
          <strong>New Manila time</strong>
          <input name="date" aria-label="New date" type="date" defaultValue={manilaDateValue(startsAt)} required />
          <input name="time" aria-label="New time" type="time" defaultValue={manilaTimeValue(startsAt)} required />
          <button>Save</button>
          <button type="button" onClick={() => setRescheduling(false)}>
            Close
          </button>
        </form></div>
      )}
      {mutation.error && <small role="alert">{mutation.error}</small>}
    </div>
  );
}

function manilaDateValue(value: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value));
}
function manilaTimeValue(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(new Date(value));
}

export function SettingsForm({ studio }: { studio: StudioSettings }) {
  const mutation = useMutation();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: "Piercing Corner",
      location: String(form.get("location")),
      address: String(form.get("address")) || null,
      email: String(form.get("email")) || null,
      phone: String(form.get("phone")) || null,
      instagramUrl: String(form.get("instagramUrl")),
      minimumLeadHours: Number(form.get("minimumLeadHours")),
      bookingHorizonDays: Number(form.get("bookingHorizonDays")),
      bookingIntervalMinutes: Number(form.get("bookingIntervalMinutes")),
      minimumAge: Number(form.get("minimumAge")),
      cancellationPolicy: String(form.get("cancellationPolicy")) || null,
    };
    if (
      await mutation.run("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    ) {
      toast.add({
        title: "Settings saved",
        description: "Your studio settings were updated successfully.",
        type: "success",
        timeout: 3_000,
        priority: "low",
      });
      requestWorkspaceRefresh();
    }
  }
  return (
    <form className={settingSection} onSubmit={submit}>
      <div className={panelHead}>
        <div>
          <h3>Studio profile & booking policy</h3>
          <p>Only configured facts are shown publicly.</p>
        </div>
        <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>
          {mutation.busy ? <LoaderCircle className="animate-[spin_1.6s_linear_infinite]" /> : <Check />} Save
          settings
        </button>
      </div>
      <div className="px-[18px] pt-0.5 pb-5">
        <div className="grid grid-cols-2 gap-[13px] max-[760px]:grid-cols-1">
          <label className={dashField}>
            Studio name
            <input value="Piercing Corner" readOnly />
          </label>
          <label className={dashField}>
            Location
            <input name="location" defaultValue={studio.location} required />
          </label>
          <label className={dashField}>
            Exact address
            <input
              name="address"
              defaultValue={studio.address ?? ""}
              placeholder="Not configured"
            />
          </label>
          <label className={dashField}>
            Studio email
            <input
              name="email"
              type="email"
              defaultValue={studio.email ?? ""}
            />
          </label>
          <label className={dashField}>
            Phone
            <input name="phone" defaultValue={studio.phone ?? ""} />
          </label>
          <label className={dashField}>
            Instagram URL
            <input
              name="instagramUrl"
              type="url"
              defaultValue={studio.instagramUrl}
              required
            />
          </label>
          <label className={dashField}>
            Lead time (hours)
            <input
              name="minimumLeadHours"
              type="number"
              min="0"
              defaultValue={studio.minimumLeadHours}
            />
          </label>
          <label className={dashField}>
            Booking horizon (days)
            <input
              name="bookingHorizonDays"
              type="number"
              min="1"
              max="365"
              defaultValue={studio.bookingHorizonDays}
            />
          </label>
          <label className={dashField}>
            Slot interval (minutes)
            <input
              name="bookingIntervalMinutes"
              type="number"
              min="5"
              defaultValue={studio.bookingIntervalMinutes}
            />
          </label>
          <label className={dashField}>
            Minimum booking age
            <input
              name="minimumAge"
              type="number"
              min="0"
              defaultValue={studio.minimumAge}
            />
          </label>
          <label className={dashField}>
            Cancellation policy
            <textarea
              name="cancellationPolicy"
              defaultValue={studio.cancellationPolicy ?? ""}
            />
          </label>
        </div>
        {mutation.error && (
          <p className={dashError} role="alert">
            {mutation.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function ServiceForm({ staff }: { staff: StaffRecord[] }) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cents = (name: string) => {
      const raw = String(form.get(name) ?? "").trim();
      return raw ? Math.round(Number(raw) * 100) : null;
    };
    const ok = await mutation.run("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name")),
        description: String(form.get("description")) || null,
        category: String(form.get("category")),
        durationMinutes: Number(form.get("durationMinutes")),
        priceCents: cents("price"),
        minPriceCents: cents("minPrice"),
        maxPriceCents: cents("maxPrice"),
        priceUnit: String(form.get("priceUnit")) || null,
        isActive: true,
        staffIds: form.getAll("staffIds").map(String),
      }),
    });
    if (ok) {
      setOpen(false);
      requestWorkspaceRefresh();
    }
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!mutation.busy || nextOpen) {
        if (nextOpen) mutation.reset();
        setOpen(nextOpen);
      }
    }} disablePointerDismissal={mutation.busy}>
      <DialogTrigger className={`${dashButton({ variant: "secondary" })} min-h-[34px] text-[9px]`}>
        <Plus size={15} /> Add service
      </DialogTrigger>
      <DialogContent className={`${operationDialog} gap-0 p-0 ring-0 sm:max-w-[720px]`} showCloseButton={false}>
        <header><div><DialogTitle>Add service</DialogTitle><DialogDescription>Create a service and assign qualified staff.</DialogDescription></div><DialogClose aria-label="Close add service form" disabled={mutation.busy}><X /></DialogClose></header>
        <form className={operationForm} onSubmit={submit}>
          <div className={operationGrid}>
      <label className={dashField}>
        Service name
        <input name="name" required />
      </label>
      <label className={dashField}>
        Description
        <input name="description" />
      </label>
      <label className={dashField}>
        Category
        <StudioSelect name="category" defaultValue="Ear Piercings" ariaLabel="Service category" options={[
          { value: "Ear Piercings", label: "Ear Piercings" },
          { value: "Face & Body Piercings", label: "Face & Body Piercings" },
          { value: "Other Services", label: "Other Services" },
        ]} />
      </label>
      <label className={dashField}>
        Duration (minutes)
        <input name="durationMinutes" type="number" min="5" required />
      </label>
      <label className={dashField}>
        Fixed price (PHP)
        <input name="price" type="number" min="0" step="0.01" />
      </label>
      <label className={dashField}>
        Minimum price (PHP)
        <input name="minPrice" type="number" min="0" step="0.01" />
      </label>
      <label className={dashField}>
        Maximum price (PHP)
        <input name="maxPrice" type="number" min="0" step="0.01" />
      </label>
      <label className={dashField}>
        Price unit (optional)
        <input name="priceUnit" placeholder="per process" />
      </label>
      <fieldset className="col-span-full flex flex-wrap gap-x-4 gap-y-[9px] rounded-[10px] border-[1.5px] border-dashed border-[#9e6748] bg-[#fff3d3] px-3 py-2.5 [&_legend]:px-[5px] [&_legend]:text-[9px] [&_legend]:font-extrabold [&_legend]:text-studio-muted [&_label]:text-[10px]">
        <legend>Qualified staff</legend>
        {staff
          .filter((item) => item.active && item.role === "piercer")
          .map((item) => (
            <label key={item.id}>
              <input name="staffIds" type="checkbox" value={item.id} />{" "}
              {item.displayName}
            </label>
          ))}
      </fieldset>
          </div>
      {mutation.error && <p className={dashError} role="alert">{mutation.error}</p>}
      <footer>
        <DialogClose className={dashButton({ variant: "secondary" })} disabled={mutation.busy}>Cancel</DialogClose>
        <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>
          {mutation.busy ? "Adding…" : "Add service"}
        </button>
      </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceAssignmentForm({
  services,
  staff,
  assignments,
}: {
  services: Service[];
  staff: StaffRecord[];
  assignments: Array<{ serviceId: string; staffId: string }>;
}) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutation.run(`/api/services/${serviceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffIds: form.getAll("staffIds").map(String) }),
    });
    if (ok) {
      setOpen(false);
      requestWorkspaceRefresh();
    }
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!mutation.busy || nextOpen) {
        if (nextOpen) mutation.reset();
        setOpen(nextOpen);
      }
    }} disablePointerDismissal={mutation.busy}>
      <DialogTrigger
        className={`${dashButton({ variant: "secondary" })} min-h-[34px] text-[9px]`}
        disabled={!services.length || !staff.length}
      >
        Manage service assignments
      </DialogTrigger>
      <DialogContent className={`${operationDialog} gap-0 p-0 ring-0 sm:max-w-[620px]`} showCloseButton={false}>
        <header><div><DialogTitle>Manage service assignments</DialogTitle><DialogDescription>Choose which piercers can perform each service.</DialogDescription></div><DialogClose aria-label="Close service assignments" disabled={mutation.busy}><X /></DialogClose></header>
        <form className={operationForm} onSubmit={submit}>
          <div className={operationGrid}>
      <label className={dashField}>
        Service
        <StudioSelect
          name="serviceId"
          value={serviceId}
          onValueChange={setServiceId}
          ariaLabel="Service"
          options={services.map((service) => ({ value: service.id, label: service.name }))}
        />
      </label>
      <fieldset className="col-span-full flex flex-wrap gap-x-4 gap-y-[9px] rounded-[10px] border-[1.5px] border-dashed border-[#9e6748] bg-[#fff3d3] px-3 py-2.5 [&_legend]:px-[5px] [&_legend]:text-[9px] [&_legend]:font-extrabold [&_legend]:text-studio-muted [&_label]:text-[10px]" key={serviceId}>
        <legend>Qualified staff</legend>
        {staff
          .filter((person) => person.active && person.role === "piercer")
          .map((person) => (
            <label key={person.id}>
              <input
                name="staffIds"
                type="checkbox"
                value={person.id}
                defaultChecked={assignments.some(
                  (item) =>
                    item.serviceId === serviceId && item.staffId === person.id,
                )}
              />{" "}
              {person.displayName}
            </label>
          ))}
      </fieldset>
          </div>
      {mutation.error && <p className={dashError} role="alert">{mutation.error}</p>}
      <footer>
        <DialogClose className={dashButton({ variant: "secondary" })} disabled={mutation.busy}>Cancel</DialogClose>
        <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>
          {mutation.busy ? "Saving…" : "Save assignments"}
        </button>
      </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AvailabilityForm({ staff }: { staff: StaffRecord[] }) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutation.run("/api/availability", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        staffId: String(form.get("staffId")),
        weekday: Number(form.get("weekday")),
        startsAt: String(form.get("startsAt")),
        endsAt: String(form.get("endsAt")),
      }),
    });
    if (ok) requestWorkspaceRefresh();
  }
  if (!open)
    return (
      <button
        className={`${dashButton({ variant: "secondary" })} ml-[18px] min-h-[34px] text-[9px]`}
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Add availability
      </button>
    );
  return (
    <form className={inlineForm} onSubmit={submit}>
      <label className={dashField}>
        Staff
        <StudioSelect name="staffId" defaultValue={staff.find((item) => item.active)?.id} ariaLabel="Staff" options={staff.filter((item) => item.active).map((item) => ({ value: item.id, label: item.displayName }))} />
      </label>
      <label className={dashField}>
        Day
        <StudioSelect name="weekday" defaultValue="0" ariaLabel="Day" options={days.map((day, index) => ({ value: String(index), label: day }))} />
      </label>
      <label className={dashField}>
        Starts
        <input name="startsAt" type="time" defaultValue="10:00" />
      </label>
      <label className={dashField}>
        Ends
        <input name="endsAt" type="time" defaultValue="18:00" />
      </label>
      {mutation.error && <p className={dashError}>{mutation.error}</p>}
      <div>
        <button
          type="button"
          className={dashButton({ variant: "secondary" })}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>
          Add hours
        </button>
      </div>
    </form>
  );
}

export function StationForm() {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutation.run("/api/stations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name")) }),
      });
    if (ok) {
      setOpen(false);
      requestWorkspaceRefresh();
    }
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!mutation.busy || nextOpen) {
        if (nextOpen) mutation.reset();
        setOpen(nextOpen);
      }
    }} disablePointerDismissal={mutation.busy}>
      <DialogTrigger className={`${dashButton({ variant: "secondary" })} min-h-[34px] text-[9px]`}>
        <Plus size={15} /> Add station
      </DialogTrigger>
      <DialogContent className={`${operationDialog} gap-0 p-0 ring-0 sm:max-w-[480px]`} showCloseButton={false}>
        <header><div><DialogTitle>Add station</DialogTitle><DialogDescription>Create another station for appointment scheduling.</DialogDescription></div><DialogClose aria-label="Close add station form" disabled={mutation.busy}><X /></DialogClose></header>
        <form className={operationForm} onSubmit={submit}>
          <div className={operationGrid}>
            <label className={`${dashField} col-span-full`}>
              Station name
              <input name="name" required />
            </label>
          </div>
          {mutation.error && <p className={dashError} role="alert">{mutation.error}</p>}
          <footer>
            <DialogClose className={dashButton({ variant: "secondary" })} disabled={mutation.busy}>Cancel</DialogClose>
            <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>{mutation.busy ? "Adding…" : "Add station"}</button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InviteForm() {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutation.run("/api/staff/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email")),
        displayName: String(form.get("displayName")),
        role: String(form.get("role")),
      }),
    });
    if (ok) {
      setOpen(false);
      requestWorkspaceRefresh();
    }
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!mutation.busy || nextOpen) {
        if (nextOpen) mutation.reset();
        setOpen(nextOpen);
      }
    }} disablePointerDismissal={mutation.busy}>
      <DialogTrigger className={`${dashButton({ variant: "secondary" })} min-h-[34px] text-[9px]`}>
        <UserPlus size={15} /> Invite staff
      </DialogTrigger>
      <DialogContent className={`${operationDialog} gap-0 p-0 ring-0 sm:max-w-[560px]`} showCloseButton={false}>
        <header><div><DialogTitle>Invite staff</DialogTitle><DialogDescription>Send an invitation and choose the staff member&apos;s initial role.</DialogDescription></div><DialogClose aria-label="Close invite staff form" disabled={mutation.busy}><X /></DialogClose></header>
        <form className={operationForm} onSubmit={submit}>
          <div className={operationGrid}>
            <label className={dashField}>Display name<input name="displayName" required /></label>
            <label className={dashField}>Email<input name="email" type="email" required /></label>
            <label className={`${dashField} col-span-full`}>Role<StudioSelect name="role" defaultValue="piercer" ariaLabel="Role" options={[{ value: "piercer", label: "Piercer" }, { value: "manager", label: "Manager" }]} /></label>
          </div>
          {mutation.error && <p className={dashError} role="alert">{mutation.error}</p>}
          <footer>
            <DialogClose className={dashButton({ variant: "secondary" })} disabled={mutation.busy}>Cancel</DialogClose>
            <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>{mutation.busy ? "Sending…" : "Send invitation"}</button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffActions({
  person,
  currentRole,
}: {
  person: StaffRecord;
  currentRole: StaffRole;
}) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(person.role);
  const [active, setActive] = useState(person.active);
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  function resetForm() {
    mutation.reset();
    setRole(person.role);
    setActive(person.active);
    setConfirmingTransfer(false);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === "owner" && !confirmingTransfer) {
      setConfirmingTransfer(true);
      return;
    }
    const ok = await mutation.run(`/api/staff/${person.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(role === "owner" ? { role } : { role, active }),
      });
    if (ok) {
      setOpen(false);
      requestWorkspaceRefresh();
    }
  }
  const summary = <>
    <span>
      <strong>{person.displayName}</strong>
      <small>{person.role} · {person.active ? "Active" : "Inactive"}</small>
    </span>
    <i className="size-2 shrink-0 rounded-full" style={{ background: person.color }} />
  </>;
  if (currentRole !== "owner" || person.role === "owner") {
    return <div className={settingsListRow}>{summary}</div>;
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!mutation.busy || nextOpen) {
        if (nextOpen) resetForm();
        setOpen(nextOpen);
      }
    }} disablePointerDismissal={mutation.busy}>
      <DialogTrigger
        type="button"
        className={`${settingsListRow} cursor-pointer transition-colors hover:bg-[#fff1cf] focus-visible:bg-[#f7dfb3] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#d66335]`}
        aria-label={`Manage ${person.displayName}`}
      >
        {summary}
      </DialogTrigger>
      <DialogContent className={`${operationDialog} gap-0 p-0 ring-0 sm:max-w-[520px]`} showCloseButton={false}>
        <header><div><DialogTitle>Manage {person.displayName}</DialogTitle><DialogDescription>Update this staff member&apos;s role and account access.</DialogDescription></div><DialogClose aria-label={`Close management for ${person.displayName}`} disabled={mutation.busy}><X /></DialogClose></header>
        <form className={operationForm} onSubmit={submit}>
          <div className={operationGrid}>
            <label className={`${dashField} col-span-full`}>Role<StudioSelect ariaLabel={`Role for ${person.displayName}`} value={role} onValueChange={(nextRole) => { setRole(nextRole as StaffRole); setConfirmingTransfer(false); }} disabled={mutation.busy} options={[{ value: "manager", label: "Manager" }, { value: "piercer", label: "Piercer" }, { value: "owner", label: "Transfer ownership" }]} /></label>
            {role !== "owner" && <fieldset className="col-span-full rounded-[12px] border-[1.5px] border-dashed border-[#9e6748] bg-[#fff3d3] p-3"><legend className="px-1 text-[9px] font-extrabold text-studio-muted">Account access</legend><label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={mutation.busy} /> Active staff account</label></fieldset>}
            {role === "owner" && <div className="col-span-full rounded-[12px] border border-[#9a4734] bg-[#f2c8b6] p-3 text-[10px]/[1.5] text-[#783321]"><strong>Ownership transfer</strong><p className="mb-0">This will make {person.displayName} the studio owner and change your own access. This action requires confirmation.</p></div>}
            {confirmingTransfer && <div className="col-span-full rounded-[12px] border-2 border-[#9a4734] bg-[#fff1e8] p-3 text-[10px]/[1.5] text-[#783321]" role="alert"><strong>Confirm ownership transfer</strong><p className="mb-0">Are you sure you want to transfer ownership to {person.displayName}?</p></div>}
          </div>
          {mutation.error && <p className={dashError} role="alert">{mutation.error}</p>}
          <footer>
            {confirmingTransfer ? <button type="button" className={dashButton({ variant: "secondary" })} onClick={() => setConfirmingTransfer(false)} disabled={mutation.busy}>Back</button> : <DialogClose className={dashButton({ variant: "secondary" })} disabled={mutation.busy}>Cancel</DialogClose>}
            <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>{mutation.busy ? "Saving…" : confirmingTransfer ? "Confirm transfer" : role === "owner" ? "Continue" : "Save changes"}</button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SaleForm({
  services,
}: {
  services: Service[];
}) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  const [clientMode, setClientMode] = useState<"walk-in" | "existing">("walk-in");
  const activeServices = services.filter((item) => item.isActive);
  const [serviceIds, setServiceIds] = useState<string[]>(activeServices[0] ? [activeServices[0].id] : []);
  const selectedServices = activeServices.filter((item) => serviceIds.includes(item.id));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedServices.length) return;
    const items = selectedServices.map((service) => ({
      type: "service",
      sourceId: service.id,
      description: service.name,
      quantity: 1,
      unitPriceCents: Math.round(Number(form.get(`salePrice:${service.id}`)) * 100),
      discountCents: 0,
    }));
    const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents, 0);
    const amount = Math.round(Number(form.get("amount")) * 100);
    const ok = await mutation.run("/api/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: clientMode === "existing" ? form.get("customerId") || null : null,
        walkInName: clientMode === "walk-in" ? form.get("walkInName") : null,
        items,
        discountCents: 0,
        payments:
          amount > 0
            ? [{ method: form.get("method"), amountCents: amount }]
            : [],
        complete: amount >= totalCents,
      }),
    });
    if (ok) { setOpen(false); requestWorkspaceRefresh(); }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!mutation.busy || nextOpen) setOpen(nextOpen);
      }}
      disablePointerDismissal={mutation.busy}
    >
      <DialogTrigger
        className={dashButton({ variant: "primary" })}
        disabled={!activeServices.length}
      >
        <Plus size={16} /> Record sale
      </DialogTrigger>
      <DialogContent className={`${operationDialog} gap-0 p-0 ring-0 sm:max-w-[720px]`} showCloseButton={false}>
        <header>
          <div>
            <DialogTitle>Record sale</DialogTitle>
            <DialogDescription>Capture the service, client, and payment received.</DialogDescription>
          </div>
          <DialogClose aria-label="Close record sale form" disabled={mutation.busy}><X /></DialogClose>
        </header>
        <form className={operationForm} onSubmit={submit}>
          <div className={operationGrid}>
            <div className="col-span-full grid grid-cols-2 rounded-xl border-[1.5px] border-hippy-ink bg-[#d9ac83] p-[3px] [&>button]:rounded-lg [&>button]:border-0 [&>button]:bg-transparent [&>button]:p-2.5 [&>button]:text-[10px] [&>button]:font-extrabold">
              <button type="button" className={clientMode === "walk-in" ? "bg-[#fff4d7]! shadow-[1px_1px_0_#3b2923]" : ""} onClick={() => setClientMode("walk-in")}>Walk-in</button>
              <button type="button" className={clientMode === "existing" ? "bg-[#fff4d7]! shadow-[1px_1px_0_#3b2923]" : ""} onClick={() => setClientMode("existing")}>Existing client</button>
            </div>
            {clientMode === "walk-in" ? <label className={`${dashField} col-span-full`}>
              Walk-in name
              <input name="walkInName" maxLength={160} placeholder="Client name" required />
            </label> : <label className={`${dashField} col-span-full`}>
              Client
              <CustomerSelect required />
            </label>}
            <fieldset className="col-span-full grid max-h-[230px] grid-cols-2 gap-[7px] overflow-auto rounded-[14px] border-[1.5px] border-hippy-ink bg-[#fae5bf] p-2.5 max-[700px]:grid-cols-1 [&>legend]:px-[7px] [&>legend]:font-black [&>label]:flex [&>label]:cursor-pointer [&>label]:items-center [&>label]:gap-2 [&>label]:rounded-[10px] [&>label]:border [&>label]:border-[#bc7c57] [&>label]:bg-[#fff8e8] [&>label]:p-2 [&>label>span]:flex [&>label>span]:flex-1 [&>label>span]:justify-between [&>label>span]:gap-1.5 [&>label>span]:text-[10px] [&_small]:text-[#81665c]">
              <legend>Services</legend>
              {activeServices.map((service) => <label key={service.id}>
                <input type="checkbox" checked={serviceIds.includes(service.id)} onChange={(event) => setServiceIds((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))} />
                <span><strong>{service.name}</strong><small>{formatServicePrice(service)}</small></span>
              </label>)}
            </fieldset>
            {selectedServices.map((service) => {
              const bounds = servicePriceBounds(service);
              return <label className={dashField} key={service.id}>
                {service.name} price (PHP)
                <input name={`salePrice:${service.id}`} type="number" min={bounds ? bounds.min / 100 : 0} max={bounds ? bounds.max / 100 : undefined} step="0.01" defaultValue={bounds ? bounds.min / 100 : undefined} required />
                <small>{formatServicePrice(service)}</small>
              </label>;
            })}
            <label className={dashField}>
              Payment received (PHP)
              <input name="amount" type="number" min="0" step="0.01" defaultValue="0" />
            </label>
            <label className={dashField}>
              Method
              <StudioSelect name="method" defaultValue="cash" ariaLabel="Payment method" options={paymentMethodOptions} />
            </label>
          </div>
          {mutation.error && <p className={dashError} role="alert">{mutation.error}</p>}
          <footer>
            <DialogClose className={dashButton({ variant: "secondary" })} disabled={mutation.busy}>Cancel</DialogClose>
            <button className={dashButton({ variant: "primary" })} disabled={mutation.busy || !serviceIds.length}>
              {mutation.busy ? "Saving…" : "Save sale"}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SaleAdjustment({
  id,
  remainingCents,
  onSaved,
}: {
  id: string;
  remainingCents: number;
  onSaved?: () => void;
}) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await mutation.run(`/api/sales/${id}/adjustments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: String(form.get("kind")),
          amountCents: Math.round(Number(form.get("amount")) * 100),
          reason: String(form.get("reason")),
        }),
      })
    ) {
      requestWorkspaceRefresh();
      onSaved?.();
    }
  }
  if (!open)
    return (
      <button
        className="min-h-[27px] cursor-pointer rounded-[7px] border border-hippy-ink bg-[#fff7e3] px-2 text-[8px] font-extrabold text-[#70402e] shadow-[1px_1px_0_#3b2923] hover:bg-[#f6d19c]"
        disabled={remainingCents <= 0}
        onClick={() => setOpen(true)}
      >
        Adjust
      </button>
    );
  return (
    <form className="grid min-w-[250px] grid-cols-[70px_75px_1fr] gap-[5px] [&>select]:h-[29px] [&>select]:min-w-0 [&>select]:rounded-md [&>select]:border [&>select]:border-hippy-ink [&>select]:bg-white [&>select]:p-1 [&>select]:text-[8px] [&>input]:h-[29px] [&>input]:min-w-0 [&>input]:rounded-md [&>input]:border [&>input]:border-hippy-ink [&>input]:bg-white [&>input]:p-1 [&>input]:text-[8px] [&>button]:h-[29px] [&>button]:rounded-md [&>button]:border [&>button]:border-hippy-ink [&>button]:bg-white [&>button]:p-1 [&>button]:text-[8px] [&>button]:font-extrabold [&>button]:text-seafoam-dark [&>small]:col-span-full [&>small]:text-danger" onSubmit={submit}>
      <StudioSelect name="kind" defaultValue="refund" ariaLabel="Adjustment type" triggerClassName="h-[29px] min-h-[29px] px-2 py-1 text-[8px]" options={[{ value: "refund", label: "Refund" }, { value: "void", label: "Void" }]} />
      <input
        name="amount"
        aria-label="Adjustment amount in PHP"
        type="number"
        min="0.01"
        max={(remainingCents / 100).toFixed(2)}
        step="0.01"
        required
      />
      <input
        name="reason"
        aria-label="Adjustment reason"
        placeholder="Reason"
        required
      />
      <button disabled={mutation.busy}>Save</button>
      <button type="button" onClick={() => setOpen(false)}>
        Close
      </button>
      {mutation.error && <small>{mutation.error}</small>}
    </form>
  );
}

export function DraftSaleActions({ sale, onSaved }: { sale: SaleRecord; onSaved?: () => void }) {
  const mutation = useMutation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const unresolved = sale.items.filter((item) => item.unitPriceCents === null);
  async function resolve(event: React.FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await mutation.run(`/api/sales/${sale.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resolve_price", itemId, unitPriceCents: Math.round(Number(form.get("price")) * 100) }) })) { requestWorkspaceRefresh(); onSaved?.(); }
  }
  async function payment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await mutation.run(`/api/sales/${sale.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add_payment", method: form.get("method"), amountCents: Math.round(Number(form.get("amount")) * 100), reference: form.get("reference") || null }) })) { requestWorkspaceRefresh(); onSaved?.(); }
  }
  return <div className="mt-2 flex min-w-0 flex-col gap-3">
    {unresolved.map((item) => <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border-[1.5px] border-dashed border-[#b76c4c] bg-[#fae1b8] p-3" key={item.id} onSubmit={(event) => void resolve(event, item.id)}>
      <div className="col-span-full flex flex-col gap-1"><strong className="text-[11px]">{item.description}</strong><small className="text-[9px] text-studio-muted">Pricing required · {formatServicePrice({ priceCents: null, minPriceCents: item.minPriceCents, maxPriceCents: item.maxPriceCents, priceUnit: null })}</small></div>
      <input className="min-h-[36px] min-w-0 rounded-[9px] border-[1.5px] border-hippy-ink bg-[#fff9eb] px-3 text-[10px]" name="price" aria-label={`Price for ${item.description} in PHP`} type="number" min={(item.minPriceCents ?? 0) / 100} max={(item.maxPriceCents ?? 0) / 100} step="0.01" required/>
      <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>Set price</button>
    </form>)}
    {!unresolved.length && !paymentOpen && <button className={`${dashButton({ variant: "primary" })} self-start`} onClick={() => setPaymentOpen(true)}><Plus size={15} /> Add payment</button>}
    {paymentOpen && <form className="grid grid-cols-2 gap-3 rounded-xl border-[1.5px] border-dashed border-[#b76c4c] bg-[#fae1b8] p-3 max-[600px]:grid-cols-1" onSubmit={payment}>
      <label className={dashField}>Amount (PHP)<input name="amount" type="number" min="0.01" max={((sale.totalCents - sale.paidCents) / 100).toFixed(2)} step="0.01" required/></label>
      <label className={dashField}>Method<StudioSelect name="method" defaultValue="cash" ariaLabel="Payment method" options={paymentMethodOptions} /></label>
      <label className={`${dashField} col-span-full max-[600px]:col-auto`}>Reference (optional)<input name="reference" /></label>
      <div className="col-span-full flex justify-end gap-2 max-[600px]:col-auto"><button type="button" className={dashButton({ variant: "secondary" })} disabled={mutation.busy} onClick={() => setPaymentOpen(false)}>Cancel</button><button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>{mutation.busy ? "Saving…" : "Save payment"}</button></div>
    </form>}
    {mutation.error && <small className={dashError} role="alert">{mutation.error}</small>}
  </div>;
}

export function ClosureForm() {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    if (
      await mutation.run("/api/closures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: `${date}T${form.get("startsAt")}:00+08:00`,
          endsAt: `${date}T${form.get("endsAt")}:00+08:00`,
          reason: String(form.get("reason")) || null,
        }),
      })
    )
      requestWorkspaceRefresh();
  }
  if (!open)
    return (
      <button
        className={`${dashButton({ variant: "secondary" })} ml-[18px] min-h-[34px] text-[9px]`}
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Add closure
      </button>
    );
  return (
    <form className={inlineForm} onSubmit={submit}>
      <label className={dashField}>
        Date
        <input name="date" type="date" required />
      </label>
      <label className={dashField}>
        Starts
        <input name="startsAt" type="time" defaultValue="10:00" required />
      </label>
      <label className={dashField}>
        Ends
        <input name="endsAt" type="time" defaultValue="18:00" required />
      </label>
      <label className={dashField}>
        Reason
        <input name="reason" />
      </label>
      {mutation.error && <p className={dashError}>{mutation.error}</p>}
      <div>
        <button
          type="button"
          className={dashButton({ variant: "secondary" })}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className={dashButton({ variant: "primary" })} disabled={mutation.busy}>
          Add closure
        </button>
      </div>
    </form>
  );
}
