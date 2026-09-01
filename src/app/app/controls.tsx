"use client";

import { Check, LoaderCircle, Plus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
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

function useMutation() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function run(url: string, options: RequestInit) {
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch(url, options);
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error?.message ?? "The change could not be saved.");
      return false;
    }
    setMessage("Saved.");
    return true;
  }
  return { busy, message, error, run };
}

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
    <div className="booking-actions">
      {status === "requested" && canManage && (
        <>
          <button disabled={mutation.busy} onClick={() => change("confirmed")}>
            Confirm
          </button>
          <button disabled={mutation.busy} onClick={() => change("rejected")}>
            Reject
          </button>
          <button
            className="danger"
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
            className="danger"
            disabled={mutation.busy}
            onClick={() => change("cancelled")}
          >
            Cancel
          </button>
        </>
      )}
      {rescheduling && (
        <div className="reschedule-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRescheduling(false); }}>
        <form className="reschedule-popover" role="dialog" aria-modal="true" aria-label="Reschedule appointment" onSubmit={reschedule}>
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
    )
      requestWorkspaceRefresh();
  }
  return (
    <form className="panel setting-section settings-form" onSubmit={submit}>
      <div className="panel-head">
        <div>
          <h3>Studio profile & booking policy</h3>
          <p>Only configured facts are shown publicly.</p>
        </div>
        <button className="btn btn-primary" disabled={mutation.busy}>
          {mutation.busy ? <LoaderCircle className="spin" /> : <Check />} Save
          settings
        </button>
      </div>
      <div className="settings-body">
        <div className="form-grid">
          <label className="field">
            Studio name
            <input value="Piercing Corner" readOnly />
          </label>
          <label className="field">
            Location
            <input name="location" defaultValue={studio.location} required />
          </label>
          <label className="field wide">
            Exact address
            <input
              name="address"
              defaultValue={studio.address ?? ""}
              placeholder="Not configured"
            />
          </label>
          <label className="field">
            Studio email
            <input
              name="email"
              type="email"
              defaultValue={studio.email ?? ""}
            />
          </label>
          <label className="field">
            Phone
            <input name="phone" defaultValue={studio.phone ?? ""} />
          </label>
          <label className="field wide">
            Instagram URL
            <input
              name="instagramUrl"
              type="url"
              defaultValue={studio.instagramUrl}
              required
            />
          </label>
          <label className="field">
            Lead time (hours)
            <input
              name="minimumLeadHours"
              type="number"
              min="0"
              defaultValue={studio.minimumLeadHours}
            />
          </label>
          <label className="field">
            Booking horizon (days)
            <input
              name="bookingHorizonDays"
              type="number"
              min="1"
              max="365"
              defaultValue={studio.bookingHorizonDays}
            />
          </label>
          <label className="field">
            Slot interval (minutes)
            <input
              name="bookingIntervalMinutes"
              type="number"
              min="5"
              defaultValue={studio.bookingIntervalMinutes}
            />
          </label>
          <label className="field">
            Minimum booking age
            <input
              name="minimumAge"
              type="number"
              min="0"
              defaultValue={studio.minimumAge}
            />
          </label>
          <label className="field wide">
            Cancellation policy
            <textarea
              name="cancellationPolicy"
              defaultValue={studio.cancellationPolicy ?? ""}
            />
          </label>
        </div>
        {mutation.error && (
          <p className="form-error" role="alert">
            {mutation.error}
          </p>
        )}
        {mutation.message && (
          <p className="save-message" role="status">
            {mutation.message}
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
    if (ok) requestWorkspaceRefresh();
  }
  if (!open)
    return (
      <button
        className="btn btn-secondary setting-add"
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Add service
      </button>
    );
  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        Service name
        <input name="name" required />
      </label>
      <label className="field">
        Description
        <input name="description" />
      </label>
      <label className="field">
        Category
        <select name="category" defaultValue="Ear Piercings">
          <option>Ear Piercings</option>
          <option>Face &amp; Body Piercings</option>
          <option>Other Services</option>
        </select>
      </label>
      <label className="field">
        Duration (minutes)
        <input name="durationMinutes" type="number" min="5" required />
      </label>
      <label className="field">
        Fixed price (PHP)
        <input name="price" type="number" min="0" step="0.01" />
      </label>
      <label className="field">
        Minimum price (PHP)
        <input name="minPrice" type="number" min="0" step="0.01" />
      </label>
      <label className="field">
        Maximum price (PHP)
        <input name="maxPrice" type="number" min="0" step="0.01" />
      </label>
      <label className="field">
        Price unit (optional)
        <input name="priceUnit" placeholder="per process" />
      </label>
      <fieldset className="staff-checks">
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
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
          Add service
        </button>
      </div>
    </form>
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
    if (ok) requestWorkspaceRefresh();
  }
  if (!open) {
    return (
      <button
        className="btn btn-secondary setting-add"
        disabled={!services.length || !staff.length}
        onClick={() => setOpen(true)}
      >
        Manage service assignments
      </button>
    );
  }
  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        Service
        <select
          name="serviceId"
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="staff-checks" key={serviceId}>
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
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
          Save assignments
        </button>
      </div>
    </form>
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
        className="btn btn-secondary setting-add"
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Add availability
      </button>
    );
  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        Staff
        <select name="staffId">
          {staff
            .filter((item) => item.active)
            .map((item) => (
              <option value={item.id} key={item.id}>
                {item.displayName}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Day
        <select name="weekday">
          {days.map((day, index) => (
            <option value={index} key={day}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Starts
        <input name="startsAt" type="time" defaultValue="10:00" />
      </label>
      <label className="field">
        Ends
        <input name="endsAt" type="time" defaultValue="18:00" />
      </label>
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
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
    if (
      await mutation.run("/api/stations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: String(form.get("name")) }),
      })
    )
      requestWorkspaceRefresh();
  }
  if (!open)
    return (
      <button
        className="btn btn-secondary setting-add"
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Add station
      </button>
    );
  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        Station name
        <input name="name" required />
      </label>
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
          Add station
        </button>
      </div>
    </form>
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
    if (ok) requestWorkspaceRefresh();
  }
  if (!open)
    return (
      <button
        className="btn btn-secondary setting-add"
        onClick={() => setOpen(true)}
      >
        <UserPlus size={15} /> Invite staff
      </button>
    );
  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        Display name
        <input name="displayName" required />
      </label>
      <label className="field">
        Email
        <input name="email" type="email" required />
      </label>
      <label className="field">
        Role
        <select name="role">
          <option value="piercer">Piercer</option>
          <option value="manager">Manager</option>
        </select>
      </label>
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
          Send invitation
        </button>
      </div>
    </form>
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
  async function update(payload: Record<string, unknown>) {
    if (
      await mutation.run(`/api/staff/${person.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    )
      requestWorkspaceRefresh();
  }
  if (currentRole !== "owner" || person.role === "owner") return null;
  return (
    <span className="staff-actions">
      <select
        aria-label={`Role for ${person.displayName}`}
        defaultValue={person.role}
        onChange={(event) => void update({ role: event.target.value })}
        disabled={mutation.busy}
      >
        <option value="manager">Manager</option>
        <option value="piercer">Piercer</option>
        <option value="owner">Transfer ownership</option>
      </select>
      <button
        type="button"
        onClick={() => void update({ active: !person.active })}
        disabled={mutation.busy}
      >
        {person.active ? "Deactivate" : "Activate"}
      </button>
      {mutation.error && <small>{mutation.error}</small>}
    </span>
  );
}

export function SaleForm({
  services,
}: {
  services: Service[];
}) {
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  const activeServices = services.filter((item) => item.isActive);
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? "");
  const selectedService = activeServices.find((item) => item.id === serviceId);
  const priceBounds = selectedService
    ? servicePriceBounds(selectedService)
    : null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const service = services.find((item) => item.id === form.get("serviceId"));
    if (!service) return;
    const unitPriceCents = Math.round(Number(form.get("salePrice")) * 100);
    const amount = Math.round(Number(form.get("amount")) * 100);
    const ok = await mutation.run("/api/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: form.get("customerId") || null,
        items: [
          {
            type: "service",
            sourceId: service.id,
            description: service.name,
            quantity: 1,
            unitPriceCents,
            discountCents: 0,
          },
        ],
        discountCents: 0,
        payments:
          amount > 0
            ? [{ method: form.get("method"), amountCents: amount }]
            : [],
        complete: amount >= unitPriceCents,
      }),
    });
    if (ok) { setOpen(false); requestWorkspaceRefresh(); }
  }
  if (!open)
    return (
      <button
        className="btn btn-primary page-add"
        disabled={!activeServices.length}
        onClick={() => setOpen(true)}
      >
        <Plus size={16} /> Record sale
      </button>
    );
  return (
    <form className="panel inline-form sale-form" onSubmit={submit}>
      <label className="field">
        Client
        <CustomerSelect />
      </label>
      <label className="field">
        Service
        <select
          name="serviceId"
          required
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
        >
          {activeServices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {formatServicePrice(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Sale price (PHP)
        <input
          key={serviceId}
          name="salePrice"
          type="number"
          min={priceBounds ? priceBounds.min / 100 : 0}
          max={priceBounds ? priceBounds.max / 100 : undefined}
          step="0.01"
          defaultValue={priceBounds ? priceBounds.min / 100 : undefined}
          required
        />
        {selectedService && <small>{formatServicePrice(selectedService)}</small>}
      </label>
      <label className="field">
        Payment received (PHP)
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
        />
      </label>
      <label className="field">
        Method
        <select name="method">
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="maya">Maya</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="other">Other</option>
        </select>
      </label>
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
          Save sale
        </button>
      </div>
    </form>
  );
}

export function SaleAdjustment({
  id,
  remainingCents,
}: {
  id: string;
  remainingCents: number;
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
    )
      requestWorkspaceRefresh();
  }
  if (!open)
    return (
      <button
        className="table-action"
        disabled={remainingCents <= 0}
        onClick={() => setOpen(true)}
      >
        Adjust
      </button>
    );
  return (
    <form className="adjustment-form" onSubmit={submit}>
      <select name="kind">
        <option value="refund">Refund</option>
        <option value="void">Void</option>
      </select>
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

export function DraftSaleActions({ sale }: { sale: SaleRecord }) {
  const mutation = useMutation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const unresolved = sale.items.filter((item) => item.unitPriceCents === null);
  async function resolve(event: React.FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await mutation.run(`/api/sales/${sale.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resolve_price", itemId, unitPriceCents: Math.round(Number(form.get("price")) * 100) }) })) requestWorkspaceRefresh();
  }
  async function payment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await mutation.run(`/api/sales/${sale.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add_payment", method: form.get("method"), amountCents: Math.round(Number(form.get("amount")) * 100), reference: form.get("reference") || null }) })) requestWorkspaceRefresh();
  }
  async function complete() {
    if (await mutation.run(`/api/sales/${sale.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete" }) })) requestWorkspaceRefresh();
  }
  return <div className="draft-sale-actions">
    {unresolved.map((item) => <form key={item.id} onSubmit={(event) => void resolve(event, item.id)}>
      <strong>{item.description}</strong><small>Pricing required · {formatServicePrice({ priceCents: null, minPriceCents: item.minPriceCents, maxPriceCents: item.maxPriceCents, priceUnit: null })}</small>
      <input name="price" aria-label={`Price for ${item.description} in PHP`} type="number" min={(item.minPriceCents ?? 0) / 100} max={(item.maxPriceCents ?? 0) / 100} step="0.01" required/><button disabled={mutation.busy}>Set price</button>
    </form>)}
    {!unresolved.length && <div className="draft-controls"><button className="table-action" onClick={() => setPaymentOpen((current) => !current)}>Add payment</button><button className="table-action" disabled={sale.paidCents < sale.totalCents || mutation.busy} onClick={() => void complete()}>Complete sale</button></div>}
    {paymentOpen && <form onSubmit={payment}><input name="amount" aria-label="Payment amount in PHP" type="number" min="0.01" max={((sale.totalCents - sale.paidCents) / 100).toFixed(2)} step="0.01" required/><select name="method"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select><input name="reference" aria-label="Payment reference" placeholder="Reference (optional)"/><button disabled={mutation.busy}>Save payment</button></form>}
    {mutation.error && <small className="form-error" role="alert">{mutation.error}</small>}
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
        className="btn btn-secondary setting-add"
        onClick={() => setOpen(true)}
      >
        <Plus size={15} /> Add closure
      </button>
    );
  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        Date
        <input name="date" type="date" required />
      </label>
      <label className="field">
        Starts
        <input name="startsAt" type="time" defaultValue="10:00" required />
      </label>
      <label className="field">
        Ends
        <input name="endsAt" type="time" defaultValue="18:00" required />
      </label>
      <label className="field">
        Reason
        <input name="reason" />
      </label>
      {mutation.error && <p className="form-error">{mutation.error}</p>}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="btn btn-primary" disabled={mutation.busy}>
          Add closure
        </button>
      </div>
    </form>
  );
}
