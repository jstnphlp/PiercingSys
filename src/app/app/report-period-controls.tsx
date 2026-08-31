"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import type { ReportPreset } from "@/lib/report-period";

type PresetLink = {
  value: ReportPreset;
  label: string;
  href: string;
};

export function ReportPeriodControls({
  activePreset,
  from,
  to,
  presets,
}: {
  activePreset: ReportPreset;
  from: string;
  to: string;
  presets: PresetLink[];
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const selectedFrom = String(values.get("from") ?? "");
    const selectedTo = String(values.get("to") ?? "");
    setIsNavigating(true);
    router.push(`/app?view=reports&period=custom&from=${encodeURIComponent(selectedFrom)}&to=${encodeURIComponent(selectedTo)}`, { scroll: false });
  }

  return (
    <section className="report-controls" aria-label="Report period">
      <nav className="report-presets" aria-label="Report period presets">
        {presets.map((item) => (
          <Link
            key={item.value}
            className={activePreset === item.value ? "active" : ""}
            href={item.href}
            prefetch={false}
            scroll={false}
            onNavigate={() => setIsNavigating(true)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form className="report-range-form" onSubmit={applyRange}>
        <label>From<input required type="date" name="from" defaultValue={from} /></label>
        <label>To<input required type="date" name="to" defaultValue={to} /></label>
        <button className="btn btn-secondary" type="submit" disabled={isNavigating}>
          {isNavigating ? "Applying…" : "Apply"}
        </button>
      </form>
      <a className="btn btn-secondary report-export" href={`/api/reports/export?from=${from}&to=${to}`}>
        <Download size={16} /> Export Excel
      </a>
    </section>
  );
}
