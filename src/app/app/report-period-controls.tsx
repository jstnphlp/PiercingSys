"use client";

import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import type { ReportPreset } from "@/lib/report-period";

export type PresetLink = {
  value: ReportPreset;
  label: string;
  href: string;
};

export function ReportPeriodControls({
  activePreset,
  from,
  to,
  presets,
  pending,
  onSelect,
}: {
  activePreset: ReportPreset;
  from: string;
  to: string;
  presets: PresetLink[];
  pending: boolean;
  onSelect: (selection: { preset: ReportPreset; from: string; to: string; href: string }) => void;
}) {
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSelect({
      preset: "custom",
      from: customFrom,
      to: customTo,
      href: `/app?view=reports&period=custom&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`,
    });
  }

  return (
    <section className="report-controls" aria-label="Report period" aria-busy={pending}>
      <nav className="report-presets" aria-label="Report period presets">
        {presets.map((item) => {
          const url = new URL(item.href, "http://reports.local");
          return (
            <button
              key={item.value}
              type="button"
              className={activePreset === item.value ? "active" : ""}
              aria-current={activePreset === item.value ? "page" : undefined}
              onClick={() => onSelect({
                preset: item.value,
                from: url.searchParams.get("from") ?? from,
                to: url.searchParams.get("to") ?? to,
                href: item.href,
              })}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <form className="report-range-form" onSubmit={applyRange}>
        <label>From<input required type="date" name="from" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
        <label>To<input required type="date" name="to" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
        <button className="btn btn-secondary" type="submit" disabled={pending}>Apply</button>
      </form>
      <a className="btn btn-secondary report-export" href={`/api/reports/export?from=${from}&to=${to}`}>
        <Download size={16} /> Export Excel
      </a>
    </section>
  );
}
