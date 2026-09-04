"use client";

import { ChevronLeft, ChevronRight, CircleDollarSign, Clock3, LoaderCircle, ShoppingBag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { calculateBalance, formatPhp, type Service } from "@/lib/domain";
import type { SaleRecord } from "@/lib/data/staff";
import type { PageMeta } from "@/lib/pagination";
import { formatPaymentMethods, formatSaleItems } from "@/lib/sales-display";
import { DraftSaleActions, SaleAdjustment, SaleForm } from "./controls";
import { dashButton, dashField, featureView, metricCard, metricGridThree, stateCard, statusClasses, tablePanel } from "./dashboard-styles";
import { SideDrawer } from "./side-drawer";

type SalesResponse = { data: SaleRecord[]; page: PageMeta };

export function SalesView({ initialSales, services }: { initialSales: SaleRecord[]; services: Service[] }) {
  const urlParams = useSearchParams();
  const initialSearch = urlParams.get("q") ?? "";
  const initialPage = Math.max(1, Number(urlParams.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState<SaleRecord | null>(null);
  const query = search.trim();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    if (page > 1) url.searchParams.set("page", String(page)); else url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  }, [page, query]);
  const key = `/api/sales?q=${encodeURIComponent(query)}&page=${page}&pageSize=25`;
  const { data: response, error, isLoading, isValidating, mutate } = useSWR<SalesResponse>(key, {
    fallbackData: page === 1 && !query ? { data: initialSales, page: { number: 1, size: 25, total: initialSales.length, totalPages: 1 } } : undefined,
    keepPreviousData: true,
  });
  const sales = response?.data ?? [];
  const total = sales.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.totalCents - item.adjustmentCents, 0);
  const outstanding = sales.filter((item) => item.status === "draft").reduce((sum, item) => sum + calculateBalance(item.totalCents, [item.paidCents]), 0);
  const meta = response?.page;

  return <div className={featureView}>
    <div className={metricGridThree}>
      <Metric icon={<CircleDollarSign />} label="Completed revenue" value={formatPhp(total)} note="Current page" />
      <Metric icon={<ShoppingBag />} label="Transactions" value={String(meta?.total ?? sales.length)} note="Matching records" />
      <Metric icon={<Clock3 />} label="Outstanding" value={formatPhp(outstanding)} note="Current page" />
    </div>
    <div className="grid grid-cols-[minmax(220px,1fr)_auto] items-end gap-3 max-[640px]:grid-cols-1">
      <div className="relative"><label className={`${dashField} w-full`}>Search sales<input className="pr-10" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Reference or client" /></label>{isValidating && <LoaderCircle className="absolute right-3 bottom-[11px] size-4 animate-[spin_1s_linear_infinite] text-hippy-orange" aria-label="Updating sales" />}</div>
      <SaleForm services={services} />
    </div>
    {error && <State title="Sales could not be loaded" detail={error.message}><button className={dashButton({ variant: "secondary" })} onClick={() => void mutate()}>Retry</button></State>}
    {!error && isLoading && !response && <State title="Loading sales…" detail="Fetching the requested page." />}
    {!error && response && sales.length ? <section className={tablePanel}><table><thead><tr><th>Reference</th><th>Client</th><th>Total</th><th>Paid</th><th>Method</th><th>Status</th><th>Items</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id} className="cursor-pointer focus:bg-[#f7dfb3] focus:outline-2 focus:-outline-offset-2 focus:outline-[#d66335]" tabIndex={0} onClick={() => setSelected(sale)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(sale); } }}>
      <td><span className="flex flex-col gap-1"><strong>{sale.reference}</strong><small>{formatDate(sale.createdAt)}</small></span></td><td>{sale.customerName}</td><td>{formatPhp(sale.totalCents)}</td><td>{formatPhp(sale.paidCents)}</td><td>{formatPaymentMethods(sale.methods)}</td><td><span className={statusClasses(sale.status)}>{sale.status.replace("_", " ")}</span></td>
      <td><small>{formatSaleItems(sale.items)}</small></td>
    </tr>)}</tbody></table><Pagination meta={meta} onPage={setPage}/></section> : !error && response && !sales.length ? <State title="No sales found" detail={query ? "Try a different search." : "Record a sale to begin."} /> : null}
    <SaleDetailsDialog sale={selected} onClose={() => setSelected(null)} />
  </div>;
}

function SaleDetailsDialog({ sale, onClose }: { sale: SaleRecord | null; onClose: () => void }) {
  if (!sale) return null;
  const netCents = sale.totalCents - sale.adjustmentCents;
  const balanceCents = calculateBalance(sale.totalCents, [sale.paidCents]);
  return <SideDrawer title={sale.reference} detail={`${formatDate(sale.createdAt)} · ${sale.customerName}`} onClose={onClose}>{(close) =>
      <div className="flex flex-col gap-[15px] p-[21px] max-[700px]:p-4">
        <div className="flex items-center justify-between gap-3"><span className={statusClasses(sale.status)}>{sale.status.replace("_", " ")}</span><span className="text-[10px] font-extrabold text-studio-muted">{formatPaymentMethods(sale.methods)}</span></div>
        <dl className="m-0 grid grid-cols-4 gap-px overflow-hidden rounded-[14px] border-[1.5px] border-hippy-ink bg-hippy-ink max-[700px]:grid-cols-2 [&>div]:bg-[#fff9eb] [&>div]:p-3 [&_dt]:mb-[5px] [&_dt]:text-[8px] [&_dt]:font-black [&_dt]:tracking-[.8px] [&_dt]:text-[#a34d30] [&_dt]:uppercase [&_dd]:m-0 [&_dd]:text-[12px]/[1.55] [&_dd]:font-bold"><div><dt>Total</dt><dd>{formatPhp(sale.totalCents)}</dd></div><div><dt>Paid</dt><dd>{formatPhp(sale.paidCents)}</dd></div><div><dt>{sale.status === "draft" ? "Balance" : "Adjustments"}</dt><dd>{formatPhp(sale.status === "draft" ? balanceCents : sale.adjustmentCents)}</dd></div><div><dt>Net total</dt><dd>{formatPhp(netCents)}</dd></div></dl>
        <section><h3 className="mt-0 mb-2 font-display text-[17px] font-bold">Items</h3><ul className="m-0 flex list-none flex-col gap-2 p-0">{sale.items.map((item) => <li className="flex items-center justify-between gap-3 rounded-[10px] border border-dashed border-[#c88f6e] bg-[#fff9eb] px-3 py-2.5 text-[10px]" key={item.id}><strong>{item.description}</strong><span>{item.unitPriceCents === null ? "Pricing required" : formatPhp(item.unitPriceCents)}</span></li>)}</ul></section>
        <div className="border-t border-dashed border-[#c88f6e] pt-4">
          {sale.adjustmentCents > 0 && <p className="mt-0 text-[9px] text-studio-muted">{formatPhp(sale.adjustmentCents)} adjusted to date.</p>}
          {sale.status === "completed" && <SaleAdjustment id={sale.id} remainingCents={sale.totalCents - sale.adjustmentCents} onSaved={close} />}
          {sale.status === "draft" && <DraftSaleActions sale={sale} onSaved={close} />}
          {sale.status === "voided" && <p className="m-0 text-[10px] text-studio-muted">No further actions are available for a voided sale.</p>}
        </div>
      </div>
  }</SideDrawer>;
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <section className={metricCard}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></section>;
}
function State({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return <section className={stateCard}><ShoppingBag/><h2>{title}</h2><p>{detail}</p>{children}</section>;
}
function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const first = (meta.number - 1) * meta.size + 1;
  const last = Math.min(meta.number * meta.size, meta.total);
  return <div className="flex min-h-14 items-center justify-between gap-3 border-t border-dashed border-[#d6a786] px-3 py-2 text-[9px] max-[760px]:flex-col max-[760px]:items-start [&>p]:m-0 [&>nav]:flex [&>nav]:items-center [&>nav]:gap-1 max-[760px]:[&>nav]:self-stretch max-[760px]:[&>nav]:justify-end">
    <p>Showing {first}–{last} of {meta.total} sales</p>
    <nav aria-label="Sales pages">
      <Button variant="outline" size="icon-sm" disabled={meta.number === 1} aria-label="Previous sales page" onClick={() => onPage(meta.number - 1)}><ChevronLeft /></Button>
      {paginationItems(meta.number, meta.totalPages).map((item, index) => item === "ellipsis"
        ? <span className="px-1" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
        : <Button key={item} variant={item === meta.number ? "default" : "outline"} size="icon-sm" aria-label={`Sales page ${item}`} aria-current={item === meta.number ? "page" : undefined} onClick={() => onPage(item)}>{item}</Button>)}
      <Button variant="outline" size="icon-sm" disabled={meta.number === meta.totalPages} aria-label="Next sales page" onClick={() => onPage(meta.number + 1)}><ChevronRight /></Button>
    </nav>
  </div>;
}
function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value)); }
