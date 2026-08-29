"use client";

import { CalendarDays, Mail, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BookingRecord, CustomerRecord } from "@/lib/data/staff";

export function ClientRecords({ customers, bookings }: { customers: CustomerRecord[]; bookings: BookingRecord[] }) {
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  return <>
    {customers.length ? <section className="panel table-panel"><table><thead><tr><th>Client</th><th>Contact</th><th>Appointments</th><th>Last activity</th></tr></thead><tbody>{customers.map((customer) => {
      const history = bookings.filter((booking) => booking.customer.id === customer.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
      return <tr key={customer.id} className="clickable-row" tabIndex={0} onClick={() => setSelected(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(customer); } }}>
        <td><strong>{customer.name}</strong></td><td><span>{customer.email}</span><small>{customer.phone}</small></td><td>{history.length}</td><td>{formatDate(history[0]?.startsAt ?? customer.createdAt)}</td>
      </tr>;
    })}</tbody></table></section> : <section className="panel state-card"><CalendarDays/><h2>No clients yet</h2><p>A client record is created automatically with their first confirmed booking.</p></section>}
    {selected && <ClientDialog customer={selected} bookings={bookings.filter((booking) => booking.customer.id === selected.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt))} onClose={() => setSelected(null)}/>} 
  </>;
}

function ClientDialog({ customer, bookings, onClose }: { customer: CustomerRecord; bookings: BookingRecord[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; ref.current?.focus();
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); if (event.key === "Tab" && ref.current) { const nodes = [...ref.current.querySelectorAll<HTMLElement>("button,[href]")]; const first = nodes[0], last = nodes.at(-1); if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); } } }
    document.addEventListener("keydown", keydown); return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="operation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="operation-dialog client-dialog" role="dialog" aria-modal="true" aria-labelledby="client-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="client-dialog-title">{customer.name}</h2><p>Client since {formatDate(customer.createdAt)}</p></div><button aria-label="Close client record" onClick={onClose}><X/></button></header>
    <div className="client-contact"><a href={`mailto:${customer.email}`}><Mail/> {customer.email}</a><a href={`tel:${customer.phone}`}><Phone/> {customer.phone}</a></div>
    <div className="client-history"><h3>Appointment history</h3>{bookings.length ? bookings.map((booking) => <article key={booking.id}>
      <div><span className={`status-pill ${booking.status}`}>{booking.status.replace("_", " ")}</span><strong>{formatDateTime(booking.startsAt)}</strong><small>{booking.reference}</small></div>
      <div className="history-services">{booking.services.map((service) => <span key={service.id}>{service.name}</span>)}</div>
      <dl><div><dt>Piercer</dt><dd>{booking.piercer?.name ?? "Unassigned"}</dd></div><div><dt>Station</dt><dd>{booking.station ?? "No station"}</dd></div><div><dt>Sale</dt><dd>{booking.saleState ?? "Not created"}</dd></div><div><dt>Notes</dt><dd>{booking.notes || "No notes"}</dd></div></dl>
    </article>) : <p className="status-note">No permitted appointments are available for this client.</p>}</div>
  </div></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
