"use client";

import { CalendarDays, ChevronRight, Mail, Phone, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { BookingRecord, CustomerRecord } from "@/lib/data/staff";
import type { PageMeta } from "@/lib/pagination";
import { isValidPhilippineMobilePhone } from "@/lib/validation";
import { pageSnapshotKey } from "./page-snapshot-policy";
import { usePageSnapshotNavigation } from "./page-snapshots";
import { requestWorkspaceRefresh, WORKSPACE_REFRESH_EVENT } from "./workspace-refresh";
import { clientTablePanel, dashButton, dashError, dashField, operationBackdrop, operationDialog, operationForm, operationGrid, pagination, stateCard, statusClasses, statusNote } from "./dashboard-styles";

export function ClientRecords({ customers, initialPage: initialPageMeta, initialQuery, canCreate }: { customers: CustomerRecord[]; initialPage: PageMeta; initialQuery: { q: string; page: number }; canCreate: boolean }) {
  const urlParams = useSearchParams();
  const snapshots = usePageSnapshotNavigation();
  const snapshotKey = pageSnapshotKey("clients", urlParams);
  const restoringSnapshot = snapshots?.pending?.key === snapshotKey &&
    snapshots.pending.view === "clients" && Boolean(snapshots.pending.snapshot);
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const initialSearch = urlParams.get("q") ?? "";
  const initialPage = Math.max(1, Number(urlParams.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(normalizeSearch(initialSearch));
  const [page, setPage] = useState(initialPage);
  const [serverDataValid, setServerDataValid] = useState(
    normalizeSearch(initialQuery.q) === normalizeSearch(initialSearch) &&
    initialQuery.page === initialPage,
  );
  const isInitialRequest = page === 1 && !debouncedSearch;
  const useServerData = isInitialRequest && serverDataValid;
  const key = useServerData ? null : `/api/customers?q=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=25`;
  const { data: apiResponse, error, isLoading, isValidating, mutate } = useSWR<{ data: CustomerRecord[]; page: PageMeta }>(key, {
    keepPreviousData: true,
    dedupingInterval: 5_000,
    revalidateOnMount: restoringSnapshot ? false : undefined,
  });

  useEffect(() => {
    const normalizedSearch = normalizeSearch(search);
    if (normalizedSearch === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setServerDataValid(false);
      setDebouncedSearch(normalizedSearch);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [debouncedSearch, search]);
  useEffect(() => {
    function refreshClients() {
      if (key) void mutate();
      else if (isInitialRequest) setServerDataValid(false);
    }
    window.addEventListener(WORKSPACE_REFRESH_EVENT, refreshClients);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, refreshClients);
  }, [isInitialRequest, key, mutate]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (debouncedSearch) url.searchParams.set("q", debouncedSearch); else url.searchParams.delete("q");
    if (page > 1) url.searchParams.set("page", String(page)); else url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  }, [debouncedSearch, page]);

  const response = useServerData ? { data: customers, page: initialPageMeta } : apiResponse;
  const visibleCustomers = response?.data ?? [];
  const meta = response?.page;

  return <>
    <section className="flex flex-col gap-2" aria-label="Client controls">
      <div className="flex items-end gap-3 max-[640px]:flex-col max-[640px]:items-stretch">
        <label className={`${dashField} min-w-[260px] flex-1`}>Search clients
          <span className="relative block"><Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-[#84685e]"/><input className="!pl-10" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone" /></span>
        </label>
        {canCreate && <button className={dashButton({ variant: "primary" })} type="button" onClick={() => setCreating(true)}><Plus size={16}/> Add client</button>}
      </div>
      <p className="min-h-4 m-0 px-0.5 text-[10px] text-studio-muted" aria-live="polite">{isValidating && !isLoading ? "Refreshing clients…" : debouncedSearch ? `Searching for “${debouncedSearch}”` : "Search by client name, email, or contact number."}</p>
    </section>
    {error && <section className={stateCard}><CalendarDays/><h2>Clients could not be loaded</h2><p>{error.message}</p><button className={dashButton({ variant: "secondary" })} onClick={() => void mutate()}>Retry</button></section>}
    {!error && isLoading && <section className={stateCard}><CalendarDays/><h2>Loading clients…</h2><p>Fetching the requested page.</p></section>}
    {!error && !isLoading && visibleCustomers.length ? <section className={clientTablePanel}>
      <table className="[&_th:nth-child(1)]:w-[24%] [&_th:nth-child(2)]:w-[25%] [&_th:nth-child(3)]:w-[17%] [&_th:nth-child(4)]:w-[12%] [&_th:nth-child(5)]:w-[17%] [&_th:nth-child(6)]:w-[5%]">
        <thead><tr><th>Client</th><th>Email</th><th>Contact number</th><th>Appointments</th><th>Last activity</th><th><span className="sr-only">Open details</span></th></tr></thead>
        <tbody>{visibleCustomers.map((customer) => <ClientRow key={customer.id} customer={customer} onOpen={() => setSelected(customer)}/>)}</tbody>
      </table>
      <PageControls meta={meta} onPage={(nextPage) => { setServerDataValid(false); setPage(nextPage); }}/>
    </section> : !error && !isLoading ? <section className={stateCard}><CalendarDays/><h2>No clients found</h2><p>{debouncedSearch ? "Try a different name, email, or contact number." : "Add a client manually or create one with their first confirmed booking."}</p></section> : null}
    {creating && (
      <AddClientDialog
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); requestWorkspaceRefresh(["clients", "overview"]); }}
      />
    )}
    {selected && <ClientDrawer key={selected.id} customer={selected} onClose={() => setSelected(null)}/>}
  </>;
}

function ClientRow({ customer, onOpen }: { customer: CustomerRecord; onOpen: () => void }) {
  return <tr className="cursor-pointer hover:bg-[#fff1cf] focus:bg-[#fff1cf] focus-within:bg-[#fff1cf] focus:outline-2 focus:-outline-offset-2 focus:outline-[#d66335]" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}>
    <td><strong className="block text-[#3b2923]">{customer.name}</strong><small className="mt-1 block text-[9px] text-[#84685e]">Client since {formatDate(customer.createdAt)}</small></td>
    <td><span className="block max-w-full truncate">{customer.email || <Placeholder/>}</span></td>
    <td><span className="block max-w-full truncate">{customer.phone || <Placeholder/>}</span></td>
    <td><span className="inline-grid min-h-6 min-w-6 place-items-center rounded-[50%_43%_54%_45%] border border-[#7d5b4d] bg-[#f8d7a5] px-1 text-[10px] font-black text-[#50362e]">{customer.appointmentCount ?? 0}</span></td>
    <td>{formatDate(customer.lastActivityAt ?? customer.createdAt)}</td>
    <td><button className="grid size-8 place-items-center rounded-[8px] p-0 text-[#50362e] hover:bg-[#f5ddba] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#d66335]" type="button" aria-label={`Open details for ${customer.name}`} onClick={(event) => { event.stopPropagation(); onOpen(); }}><ChevronRight className="size-4"/></button></td>
  </tr>;
}

function Placeholder() { return <span className="text-[#9a8177]">—</span>; }

function PageControls({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return <nav className={pagination} aria-label="Client pages"><button className={dashButton({ variant: "secondary" })} disabled={meta.number <= 1} onClick={() => onPage(meta.number - 1)}>Previous</button><span>Page {meta.number} of {meta.totalPages} · {meta.total} clients</span><button className={dashButton({ variant: "secondary" })} disabled={meta.number >= meta.totalPages} onClick={() => onPage(meta.number + 1)}>Next</button></nav>;
}

function AddClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const phoneInvalid = phone.length > 0 && !isValidPhilippineMobilePhone(phone);
  useDialogFocus(ref, onClose, busy);
  useEffect(() => { firstInput.current?.focus(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidPhilippineMobilePhone(phone)) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"), phone: form.get("phone") }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The client could not be saved.");
      onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The client could not be saved."); setBusy(false); }
  }
  return <div className={operationBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className={`${operationDialog} max-w-[580px]`} role="dialog" aria-modal="true" aria-labelledby="add-client-dialog-title" tabIndex={-1} ref={ref}>
    <header><div><h2 id="add-client-dialog-title">Add client</h2><p>Create a client record without booking an appointment.</p></div><button type="button" aria-label="Close add client form" disabled={busy} onClick={onClose}><X/></button></header>
    <form className={operationForm} onSubmit={submit}>
      <div className={operationGrid}>
        <label className={dashField}>First name<input ref={firstInput} name="firstName" autoComplete="given-name" maxLength={80} required/></label>
        <label className={dashField}>Last name<input name="lastName" autoComplete="family-name" maxLength={80} required/></label>
        <label className={dashField}>Email<input name="email" type="email" autoComplete="email" required/></label>
        <label className={dashField}>Contact number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} aria-invalid={phoneInvalid} aria-describedby="client-phone-help client-phone-error" required/><small id="client-phone-help">Philippine mobile format: 09171234567 or +639171234567.</small>{phoneInvalid && <small id="client-phone-error" className="mt-1 block text-[#9a4734]" role="alert">Enter a valid Philippine mobile number.</small>}</label>
      </div>
      {error && <p className={dashError} role="alert">{error}</p>}
      <footer><button className={dashButton({ variant: "secondary" })} type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={dashButton({ variant: "primary" })} disabled={busy || phoneInvalid}>{busy ? "Saving…" : "Save client"}</button></footer>
    </form>
  </div></div>;
}

function ClientDrawer({ customer, onClose }: { customer: CustomerRecord; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useDialogFocus(ref, onClose);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/customers/${customer.id}/bookings`).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "History could not be loaded."); if (!cancelled) setBookings(body.data ?? []); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "History could not be loaded."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customer.id]);
  return <div className={`${operationBackdrop} place-items-stretch p-0`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="ml-auto flex h-full w-[min(590px,100%)] flex-col overflow-hidden border-l-2 border-hippy-ink bg-[#fff5df] shadow-[-7px_0_0_#3b2923] outline-none" role="dialog" aria-modal="true" aria-labelledby="client-drawer-title" tabIndex={-1} ref={ref}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-dashed border-[#c88f6e] px-[21px] py-[19px]"><div className="min-w-0"><p className="m-0 text-[9px] font-black uppercase tracking-[.8px] text-[#a04b2f]">Client details</p><h2 id="client-drawer-title" className="mt-1 mb-0 break-words font-display text-[23px] font-bold text-hippy-ink">{customer.name}</h2><p className="mt-[5px] mb-0 text-[11px] text-[#785d53]">Client since {formatDate(customer.createdAt)}</p></div><button className="grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-hippy-ink bg-[#efc6a4] p-0 leading-none [&>svg]:block [&>svg]:size-4" aria-label="Close client record" onClick={onClose}><X/></button></header>
    <div className="overflow-y-auto px-[21px] py-[18px]"><div className="grid grid-cols-2 gap-2.5 max-[500px]:grid-cols-1"><ContactLink icon={<Mail/>} label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : undefined}/><ContactLink icon={<Phone/>} label="Contact number" value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : undefined}/></div>
      <div className="mt-6"><div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="m-0 font-display text-[18px] font-bold">Appointment history</h3><small className="text-[9px] text-[#84685e]">Manila time</small></div>{loading && <p className={statusNote}>Loading appointments…</p>}{error && <p className={dashError} role="alert">{error}</p>}{!loading && !error && (bookings.length ? <AppointmentHistory bookings={bookings}/> : <p className={`${statusNote} rounded-[12px] border border-dashed border-[#c88f6e] bg-[#fff9eb] p-5 text-center`}>No permitted appointments are available for this client.</p>)}</div>
    </div>
  </div></div>;
}

function ContactLink({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = <><span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.7px] text-[#a04b2f] [&>svg]:size-3.5">{icon}{label}</span><span className={`mt-2 block truncate text-[11px] font-bold ${value ? "text-[#3b2923]" : "text-[#9a8177]"}`}>{value || "—"}</span></>;
  return href ? <a className="min-w-0 rounded-[12px_8px_13px_9px] border-[1.5px] border-hippy-ink bg-[#f8d7a5] p-3 shadow-[2px_2px_0_#7d5b4d] focus-visible:outline-2 focus-visible:outline-[#d66335]" href={href}>{content}</a> : <div className="min-w-0 rounded-[12px_8px_13px_9px] border-[1.5px] border-hippy-ink bg-[#f8d7a5] p-3 shadow-[2px_2px_0_#7d5b4d]">{content}</div>;
}

function AppointmentHistory({ bookings }: { bookings: BookingRecord[] }) {
  return <div className="overflow-x-auto rounded-[13px_9px_14px_10px] border-[1.5px] border-hippy-ink"><table className="min-w-[520px] w-full border-collapse bg-[#fff9eb] [&_th]:h-9 [&_th]:bg-[#f5ddba] [&_th]:px-3 [&_th]:text-left [&_th]:text-[8px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.6px] [&_th]:text-[#795346] [&_td]:border-t [&_td]:border-dashed [&_td]:border-[#dab08f] [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-[10px] [&_td]:text-[#695249]"><thead><tr><th>Timestamp</th><th>Piercer</th><th>Piercing type</th><th>Completion status</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><strong className="block text-[#3b2923]">{formatDate(booking.startsAt)}</strong><small className="text-[#84685e]">{formatTime(booking.startsAt)}</small></td><td>{booking.piercer?.name ?? "Unassigned"}</td><td className="max-w-[160px]"><span className="block truncate font-bold text-[#3b2923]" title={booking.services.map((service) => service.name).join(", ")}>{formatServices(booking)}</span></td><td><span className={statusClasses(booking.status)}>{formatStatus(booking.status)}</span></td></tr>)}</tbody></table></div>;
}

function useDialogFocus(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void, busy = false) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    function keydown(event: KeyboardEvent) { if (event.key === "Escape" && !busy) onClose(); if (event.key === "Tab" && ref.current) { const nodes = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href]')]; const first = nodes[0], last = nodes.at(-1); if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); } } }
    document.addEventListener("keydown", keydown); return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [busy, onClose, ref]);
}

function normalizeSearch(value: string) { return value.trim().replace(/\s+/g, " "); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
function formatStatus(value: BookingRecord["status"]) { return value.replaceAll("_", " "); }
function formatServices(booking: BookingRecord) { const [first, ...rest] = booking.services; return first ? `${first.name}${rest.length ? ` +${rest.length}` : ""}` : "No service"; }
