"use client";

import { CalendarDays, Mail, Phone, Plus, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { BookingRecord, CustomerRecord } from "@/lib/data/staff";
import type { PageMeta } from "@/lib/pagination";
import { requestWorkspaceRefresh } from "./workspace-refresh";
import { dashButton, dashError, dashField, operationBackdrop, operationDialog, operationForm, operationGrid, pagination, stateCard, statusClasses, statusNote, tablePanel } from "./dashboard-styles";

export function ClientRecords({ customers, canCreate }: { customers: CustomerRecord[]; canCreate: boolean }) {
  const urlParams = useSearchParams();
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const initialSearch = urlParams.get("q") ?? "";
  const initialPage = Math.max(1, Number(urlParams.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (debouncedSearch) url.searchParams.set("q", debouncedSearch); else url.searchParams.delete("q");
    if (page > 1) url.searchParams.set("page", String(page)); else url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  }, [debouncedSearch, page]);
  const key = `/api/customers?q=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=25`;
  const { data: response, error, isLoading, isValidating, mutate } = useSWR<{ data: CustomerRecord[]; page: PageMeta }>(key, {
    fallbackData: page === 1 && !debouncedSearch ? {
      data: customers,
      page: { number: 1, size: 25, total: customers.length, totalPages: 1 },
    } : undefined,
  });
  const visibleCustomers = response?.data ?? [];
  const meta = response?.page;
  return <>
    <div className="flex items-end gap-3 max-[640px]:flex-col max-[640px]:items-stretch">
      <label className={`${dashField} min-w-[240px] flex-1`}>Search clients<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, or phone" /></label>
      {isValidating && !isLoading && <span className={statusNote}>Refreshing…</span>}
      {canCreate && <button className={dashButton({ variant: "primary" })} type="button" onClick={() => setCreating(true)}><Plus size={16}/> Add client</button>}
    </div>
    {error && <section className={stateCard}><CalendarDays/><h2>Clients could not be loaded</h2><p>{error.message}</p><button className={dashButton({ variant: "secondary" })} onClick={() => void mutate()}>Retry</button></section>}
    {!error && isLoading && <section className={stateCard}><CalendarDays/><h2>Loading clients…</h2><p>Fetching the requested page.</p></section>}
    {!error && !isLoading && visibleCustomers.length ? <section className={tablePanel}><table><thead><tr><th>Client</th><th>Contact</th><th>Appointments</th><th>Last activity</th></tr></thead><tbody>{visibleCustomers.map((customer) => {
      return <tr key={customer.id} className="cursor-pointer hover:bg-[#f7dfb3] focus:bg-[#f7dfb3] focus:outline-2 focus:-outline-offset-2 focus:outline-[#d66335]" tabIndex={0} onClick={() => setSelected(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(customer); } }}>
        <td><strong>{customer.name}</strong></td><td><span>{customer.email}</span><small>{customer.phone}</small></td><td>{customer.appointmentCount ?? 0}</td><td>{formatDate(customer.lastActivityAt ?? customer.createdAt)}</td>
      </tr>;
    })}</tbody></table><PageControls meta={meta} onPage={setPage}/></section> : !error && !isLoading ? <section className={stateCard}><CalendarDays/><h2>No clients found</h2><p>{debouncedSearch ? "Try a different search." : "Add a client manually or create one with their first confirmed booking."}</p></section> : null}
    {creating && <AddClientDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); requestWorkspaceRefresh(); void mutate(); }}/>}
    {selected && <ClientDialog key={selected.id} customer={selected} onClose={() => setSelected(null)}/>}
  </>;
}

function PageControls({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return <nav className={pagination} aria-label="Client pages"><button className={dashButton({ variant: "secondary" })} disabled={meta.number <= 1} onClick={() => onPage(meta.number - 1)}>Previous</button><span>Page {meta.number} of {meta.totalPages} · {meta.total} clients</span><button className={dashButton({ variant: "secondary" })} disabled={meta.number >= meta.totalPages} onClick={() => onPage(meta.number + 1)}>Next</button></nav>;
}

function AddClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstInput.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab" && ref.current) {
        const nodes = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href]')];
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [busy, onClose]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          phone: form.get("phone"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The client could not be saved.");
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The client could not be saved.");
      setBusy(false);
    }
  }
  return <div className={operationBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className={`${operationDialog} max-w-[580px]`} role="dialog" aria-modal="true" aria-labelledby="add-client-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="add-client-dialog-title">Add client</h2><p>Create a client record without booking an appointment.</p></div><button type="button" aria-label="Close add client form" disabled={busy} onClick={onClose}><X/></button></header>
    <form className={operationForm} onSubmit={submit}>
      <div className={operationGrid}>
        <label className={dashField}>First name<input ref={firstInput} name="firstName" autoComplete="given-name" maxLength={80} required/></label>
        <label className={dashField}>Last name<input name="lastName" autoComplete="family-name" maxLength={80} required/></label>
        <label className={dashField}>Email<input name="email" type="email" autoComplete="email" required/></label>
        <label className={dashField}>Phone<input name="phone" type="tel" autoComplete="tel" minLength={7} maxLength={30} required/></label>
      </div>
      {error && <p className={dashError} role="alert">{error}</p>}
      <footer><button className={dashButton({ variant: "secondary" })} type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={dashButton({ variant: "primary" })} disabled={busy}>{busy ? "Saving…" : "Save client"}</button></footer>
    </form>
  </div></div>;
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
  return <div className={operationBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={operationDialog} role="dialog" aria-modal="true" aria-labelledby="client-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="client-dialog-title">{customer.name}</h2><p>Client since {formatDate(customer.createdAt)}</p></div><button aria-label="Close client record" onClick={onClose}><X/></button></header>
    <div className="flex flex-wrap gap-2.5 border-b border-dashed border-[#c88f6e] px-[21px] py-4 [&_a]:flex [&_a]:items-center [&_a]:gap-[7px] [&_a]:rounded-[10px] [&_a]:border [&_a]:border-hippy-ink [&_a]:bg-[#f8d7a5] [&_a]:px-[11px] [&_a]:py-2 [&_a]:text-[11px] [&_a]:text-[#50362e] [&_svg]:w-[15px]"><a href={`mailto:${customer.email}`}><Mail/> {customer.email}</a><a href={`tel:${customer.phone}`}><Phone/> {customer.phone}</a></div>
    <div className="px-[21px] py-[18px] [&>h3]:mt-0 [&>h3]:mb-[13px] [&>h3]:font-display [&>h3]:text-[17px] [&>h3]:font-bold [&>article]:grid [&>article]:grid-cols-[minmax(155px,.7fr)_1fr] [&>article]:gap-[13px] [&>article]:border-t [&>article]:border-dashed [&>article]:border-[#c88f6e] [&>article]:py-3.5 max-[650px]:[&>article]:grid-cols-1 [&>article>div:first-child]:flex [&>article>div:first-child]:flex-col [&>article>div:first-child]:items-start [&>article>div:first-child]:gap-[5px] [&_article_small]:text-[#84685e] [&_dl]:col-span-full [&_dl]:m-0 [&_dl]:grid [&_dl]:grid-cols-4 [&_dl]:gap-2 max-[650px]:[&_dl]:grid-cols-2 [&_dl>div]:rounded-[9px] [&_dl>div]:border [&_dl>div]:border-[#d4a17f] [&_dl>div]:bg-[#fff9eb] [&_dl>div]:p-[9px] [&_dt]:text-[8px] [&_dt]:font-black [&_dt]:text-[#a04b2f] [&_dt]:uppercase [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:text-[10px]/[1.4]"><h3>Appointment history</h3>{loading && <p className={statusNote}>Loading appointments…</p>}{error && <p className={dashError} role="alert">{error}</p>}{!loading && !error && (bookings.length ? bookings.map((booking) => <article key={booking.id}>
      <div><span className={statusClasses(booking.status)}>{booking.status.replace("_", " ")}</span><strong>{formatDateTime(booking.startsAt)}</strong><small>{booking.reference}</small></div>
      <div className="flex flex-wrap content-start gap-1.5 [&>span]:rounded-full [&>span]:border [&>span]:border-[#6d4d42] [&>span]:bg-[#efc76f] [&>span]:px-[9px] [&>span]:py-1.5 [&>span]:text-[9px] [&>span]:font-extrabold">{booking.services.map((service) => <span key={service.id}>{service.name}</span>)}</div>
      <dl><div><dt>Piercer</dt><dd>{booking.piercer?.name ?? "Unassigned"}</dd></div><div><dt>Station</dt><dd>{booking.station ?? "No station"}</dd></div><div><dt>Sale</dt><dd>{booking.saleState ?? "Not created"}</dd></div><div><dt>Notes</dt><dd>{booking.notes || "No notes"}</dd></div></dl>
    </article>) : <p className={statusNote}>No permitted appointments are available for this client.</p>)}</div>
  </div></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
