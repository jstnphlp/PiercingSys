"use client";

import { CircleDollarSign, Clock3, ShoppingBag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { calculateBalance, formatPhp, type Service } from "@/lib/domain";
import type { SaleRecord } from "@/lib/data/staff";
import type { PageMeta } from "@/lib/pagination";
import { DraftSaleActions, SaleAdjustment, SaleForm } from "./controls";

type SalesResponse = { data: SaleRecord[]; page: PageMeta };

export function SalesView({ initialSales, services }: { initialSales: SaleRecord[]; services: Service[] }) {
  const urlParams = useSearchParams();
  const initialSearch = urlParams.get("q") ?? "";
  const initialPage = Math.max(1, Number(urlParams.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(initialSearch);
  const [query, setQuery] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    if (page > 1) url.searchParams.set("page", String(page)); else url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  }, [page, query]);
  const key = `/api/sales?q=${encodeURIComponent(query)}&page=${page}&pageSize=25`;
  const { data: response, error, isLoading, isValidating, mutate } = useSWR<SalesResponse>(key, {
    fallbackData: page === 1 && !query ? { data: initialSales, page: { number: 1, size: 25, total: initialSales.length, totalPages: 1 } } : undefined,
  });
  const sales = response?.data ?? [];
  const total = sales.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.totalCents - item.adjustmentCents, 0);
  const outstanding = sales.filter((item) => item.status === "draft").reduce((sum, item) => sum + calculateBalance(item.totalCents, [item.paidCents]), 0);
  const meta = response?.page;

  return <div className="feature-view">
    <div className="metric-grid compact">
      <Metric icon={<CircleDollarSign />} label="Completed revenue" value={formatPhp(total)} note="Current page" />
      <Metric icon={<ShoppingBag />} label="Transactions" value={String(meta?.total ?? sales.length)} note="Matching records" />
      <Metric icon={<Clock3 />} label="Outstanding" value={formatPhp(outstanding)} note="Current page" />
    </div>
    <div className="sales-toolbar">
      <div className="sales-search"><label className="field">Search sales<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference or client" /></label>{isValidating && !isLoading && <span className="status-note">Refreshing…</span>}</div>
      <SaleForm services={services} />
    </div>
    {error && <State title="Sales could not be loaded" detail={error.message}><button className="btn btn-secondary" onClick={() => void mutate()}>Retry</button></State>}
    {!error && isLoading && <State title="Loading sales…" detail="Fetching the requested page." />}
    {!error && !isLoading && sales.length ? <section className="panel table-panel"><table><thead><tr><th>Reference</th><th>Client</th><th>Total</th><th>Paid</th><th>Method</th><th>Status</th><th>Items</th><th>Adjustments</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}>
      <td><strong>{sale.reference}</strong><small>{formatDate(sale.createdAt)}</small></td><td>{sale.customerName}</td><td>{formatPhp(sale.totalCents)}</td><td>{formatPhp(sale.paidCents)}</td><td>{sale.methods.join(", ") || "—"}</td><td><span className={`status-pill ${sale.status}`}>{sale.status.replace("_", " ")}</span></td>
      <td>{sale.items.map((item) => <small key={item.id}>{item.description} · {item.unitPriceCents === null ? "Pricing required" : formatPhp(item.unitPriceCents)}</small>)}</td>
      <td>{sale.adjustmentCents > 0 && <small>{formatPhp(sale.adjustmentCents)} adjusted</small>}{sale.status === "completed" && <SaleAdjustment id={sale.id} remainingCents={sale.totalCents - sale.adjustmentCents} />}{sale.status === "draft" && <DraftSaleActions sale={sale} />}</td>
    </tr>)}</tbody></table><Pagination meta={meta} onPage={setPage}/></section> : !error && !isLoading ? <State title="No sales found" detail={query ? "Try a different search." : "Record a sale to begin."} /> : null}
  </div>;
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <section className="metric-card compact"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></section>;
}
function State({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return <section className="panel state-card"><ShoppingBag/><h2>{title}</h2><p>{detail}</p>{children}</section>;
}
function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Sales pages"><button className="btn btn-secondary" disabled={meta.number <= 1} onClick={() => onPage(meta.number - 1)}>Previous</button><span>Page {meta.number} of {meta.totalPages} · {meta.total} sales</span><button className="btn btn-secondary" disabled={meta.number >= meta.totalPages} onClick={() => onPage(meta.number + 1)}>Next</button></nav>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)); }
