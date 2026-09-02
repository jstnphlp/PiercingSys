"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, CircleDollarSign, ShoppingBag } from "lucide-react";
import { formatPhp } from "@/lib/domain";
import { validateReportRange, type ReportPeriod, type ReportPreset } from "@/lib/report-period";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ReportPeriodControls, type PresetLink } from "./report-period-controls";
import { WORKSPACE_REFRESH_EVENT } from "./workspace-refresh";

export type ReportSummary = {
  revenue_cents?: number;
  completed_sales?: number;
  sale_count?: number;
  booking_count?: number;
  booking_statuses?: Record<string, number>;
  methods?: Record<string, number>;
};

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <section className="metric-card compact"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></section>;
}

function PanelHead({ title, detail }: { title: string; detail: string }) {
  return <div className="panel-head"><div><h3>{title}</h3><p>{detail}</p></div></div>;
}

export function ReportsView({ initialPeriod, initialSummary, presets }: {
  initialPeriod: ReportPeriod;
  initialSummary: ReportSummary;
  presets: PresetLink[];
}) {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [period, setPeriod] = useState(initialPeriod);
  const [summary, setSummary] = useState(initialSummary);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const cache = useRef(new Map([[`${initialPeriod.from}:${initialPeriod.to}`, initialSummary]]));

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function refresh() {
      const { data, error: queryError } = await supabase!.rpc("studio_report", {
        p_start: period.startUtc,
        p_end: period.endUtc,
      });
      if (cancelled || queryError) return;
      const nextSummary = (data ?? {}) as ReportSummary;
      cache.current.set(`${period.from}:${period.to}`, nextSummary);
      setSummary(nextSummary);
    }
    function onRefresh() { void refresh(); }
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => { cancelled = true; window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh); };
  }, [period, supabase]);

  async function selectPeriod(selection: { preset: ReportPreset; from: string; to: string; href: string }) {
    const validated = validateReportRange(selection.from, selection.to);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    const nextPeriod: ReportPeriod = { preset: selection.preset, ...validated.period };
    const cacheKey = `${nextPeriod.from}:${nextPeriod.to}`;
    const currentRequest = ++requestId.current;
    setPeriod(nextPeriod);
    setError(null);
    window.history.pushState(null, "", selection.href);

    const cached = cache.current.get(cacheKey);
    if (cached) {
      setSummary(cached);
      setPending(false);
      return;
    }
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setPending(true);
    const { data, error: queryError } = await supabase.rpc("studio_report", {
      p_start: nextPeriod.startUtc,
      p_end: nextPeriod.endUtc,
    });
    if (requestId.current !== currentRequest) return;
    setPending(false);
    if (queryError) {
      setSummary({ sale_count: 0, booking_count: 0 });
      setError(queryError.message);
      return;
    }
    const nextSummary = (data ?? {}) as ReportSummary;
    cache.current.set(cacheKey, nextSummary);
    setSummary(nextSummary);
  }

  const revenue = Number(summary.revenue_cents ?? 0);
  const completedCount = Number(summary.completed_sales ?? 0);
  const bookingStatuses = summary.booking_statuses ?? {};
  const methodTotals = Object.entries(summary.methods ?? {});
  const canExport = !pending && Number(summary.sale_count ?? 0) > 0;

  return (
    <div className="feature-view">
      <ReportPeriodControls
        activePreset={period.preset}
        from={period.from}
        to={period.to}
        presets={presets}
        pending={pending}
        canExport={canExport}
        onSelect={(selection) => void selectPeriod(selection)}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="metric-grid compact" aria-live="polite">
        <Metric icon={<CircleDollarSign />} label="Revenue" value={formatPhp(revenue)} note={`${period.from} to ${period.to}`} />
        <Metric icon={<ShoppingBag />} label="Transactions" value={String(completedCount)} note="Completed" />
        <Metric icon={<CalendarDays />} label="Procedures" value={String(bookingStatuses.completed ?? 0)} note={`${bookingStatuses.no_show ?? 0} no-shows`} />
      </div>
      <div className="two-panel">
        <section className="panel">
          <PanelHead title="Payment methods" detail="Collected amounts" />
          {methodTotals.length ? <div className="report-list">{methodTotals.map(([method, amount]) => <div key={method}><span>{method.replaceAll("_", " ")}</span><strong>{formatPhp(Number(amount))}</strong></div>)}</div>
            : <div className="empty-state"><span><CircleDollarSign /></span><strong>No report data</strong><p>Complete a sale to populate this report.</p></div>}
        </section>
        <section className="panel">
          <PanelHead title="Appointment outcomes" detail="Selected report period" />
          <div className="report-list">
            {["requested", "confirmed", "completed", "cancelled", "no_show", "rejected"].map((status) => <div key={status}><span>{status.replaceAll("_", " ")}</span><strong>{bookingStatuses[status] ?? 0}</strong></div>)}
          </div>
        </section>
      </div>
      <p className="report-note">Operational reporting only; this is not a tax invoice or official accounting ledger.</p>
    </div>
  );
}
