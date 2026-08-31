"use client";

import { CalendarDays, Mail, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BookingRecord, CustomerRecord } from "@/lib/data/staff";

export function ClientRecords({ customers }: { customers: CustomerRecord[] }) {
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  return <>
    {customers.length ? <section className="panel table-panel"><table><thead><tr><th>Client</th><th>Contact</th><th>Appointments</th><th>Last activity</th></tr></thead><tbody>{customers.map((customer) => {
      return <tr key={customer.id} className="clickable-row" tabIndex={0} onClick={() => setSelected(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(customer); } }}>
        <td><strong>{customer.name}</strong></td><td><span>{customer.email}</span><small>{customer.phone}</small></td><td>{customer.appointmentCount ?? 0}</td><td>{formatDate(customer.lastActivityAt ?? customer.createdAt)}</td>
      </tr>;
    })}</tbody></table></section> : <section className="panel state-card"><CalendarDays/><h2>No clients yet</h2><p>A client record is created automatically with their first confirmed booking.</p></section>}
    {selected && <ClientDialog key={selected.id} customer={selected} onClose={() => setSelected(null)}/>}
  </>;
}

function ClientDialog({ customer, onClose }: { customer: CustomerRecord; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; ref.current?.focus();
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); if (event.key === "Tab" && ref.current) { const nodes = [...ref.current.querySelectorAll<HTMLElement>("button,[href]")]; const first = nodes[0], last = nodes.at(-1); if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); } } }
    document.addEventListener("keydown", keydown); return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/customers/${customer.id}/bookings`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "History could not be loaded.");
        if (!cancelled) setBookings(body.data ?? []);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "History could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [customer.id]);
  return <div className="operation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="operation-dialog client-dialog" role="dialog" aria-modal="true" aria-labelledby="client-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="client-dialog-title">{customer.name}</h2><p>Client since {formatDate(customer.createdAt)}</p></div><button aria-label="Close client record" onClick={onClose}><X/></button></header>
    <div className="client-contact"><a href={`mailto:${customer.email}`}><Mail/> {customer.email}</a><a href={`tel:${customer.phone}`}><Phone/> {customer.phone}</a></div>
    <div className="client-history"><h3>Appointment history</h3>{loading && <p className="status-note">Loading appointments…</p>}{error && <p className="form-error" role="alert">{error}</p>}{!loading && !error && (bookings.length ? bookings.map((booking) => <article key={booking.id}>
      <div><span className={`status-pill ${booking.status}`}>{booking.status.replace("_", " ")}</span><strong>{formatDateTime(booking.startsAt)}</strong><small>{booking.reference}</small></div>
      <div className="history-services">{booking.services.map((service) => <span key={service.id}>{service.name}</span>)}</div>
      <dl><div><dt>Piercer</dt><dd>{booking.piercer?.name ?? "Unassigned"}</dd></div><div><dt>Station</dt><dd>{booking.station ?? "No station"}</dd></div><div><dt>Sale</dt><dd>{booking.saleState ?? "Not created"}</dd></div><div><dt>Notes</dt><dd>{booking.notes || "No notes"}</dd></div></dl>
    </article>) : <p className="status-note">No permitted appointments are available for this client.</p>)}</div>
  </div></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
