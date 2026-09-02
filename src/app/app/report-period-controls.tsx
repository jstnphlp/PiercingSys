"use client";

import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import type { ReportPreset } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { dashButton } from "./dashboard-styles";

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
  canExport,
  onSelect,
}: {
  activePreset: ReportPreset;
  from: string;
  to: string;
  presets: PresetLink[];
  pending: boolean;
  canExport: boolean;
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
    <section className="grid grid-cols-[minmax(430px,1fr)_auto_auto] items-end gap-3.5 rounded-[18px_12px_17px_13px] border-2 border-hippy-ink bg-[#fff8e9] p-3.5 shadow-[4px_4px_0_#3b2923] max-[1180px]:grid-cols-[1fr_auto] max-[760px]:flex max-[760px]:items-stretch max-[760px]:gap-3 max-[760px]:flex-wrap" aria-label="Report period" aria-busy={pending}>
      <nav className="grid grid-cols-5 gap-[5px] rounded-[14px_10px_13px_11px] border-2 border-hippy-ink bg-[#edc879] p-[5px] shadow-[inset_0_0_0_2px_#f8dea6] max-[1180px]:col-span-full max-[760px]:flex max-[760px]:w-full max-[760px]:flex-nowrap max-[760px]:overflow-x-auto max-[760px]:[scrollbar-width:none] max-[760px]:[&::-webkit-scrollbar]:hidden" aria-label="Report period presets">
        {presets.map((item) => {
          const url = new URL(item.href, "http://reports.local");
          return (
            <button
              key={item.value}
              type="button"
              className={cn("inline-flex min-h-[39px] items-center justify-center rounded-[9px_7px_10px_8px] border-[1.5px] border-transparent px-2.5 text-center text-[9px] font-black tracking-[.35px] text-[#654438] uppercase transition hover:-translate-y-px hover:border-[#9f5535] hover:bg-[#fff3d5] hover:text-hippy-rust max-[760px]:min-w-[105px]", activePreset === item.value && "-translate-px -rotate-[.35deg] border-2 border-hippy-ink bg-hippy-orange text-[#fff9e8] shadow-[2px_2px_0_#3b2923]")}
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
      <form className="relative flex items-end gap-2 border-l-2 border-dashed border-[#c78e6a] pl-3.5 max-[1180px]:border-l-0 max-[1180px]:pl-0 max-[760px]:w-full max-[760px]:flex-wrap [&>label]:flex [&>label]:flex-1 [&>label]:flex-col [&>label]:gap-[5px] [&>label]:text-[8px] [&>label]:font-extrabold [&>label]:tracking-[.65px] [&>label]:text-[#845849] [&>label]:uppercase [&_input]:min-h-[39px] [&_input]:w-full [&_input]:rounded-[9px_7px_10px_8px] [&_input]:border-[1.5px] [&_input]:border-hippy-ink [&_input]:bg-[#fffdf5] [&_input]:px-[7px] [&_input]:py-[5px] [&_input]:text-[9px] [&_input]:font-[750] [&_input]:text-hippy-ink" onSubmit={applyRange}>
        <label>From<input required type="date" name="from" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
        <label>To<input required type="date" name="to" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
        <button className={`${dashButton({ variant: "secondary" })} min-h-[39px] bg-hippy-gold text-[9px] text-hippy-ink`} type="submit" disabled={pending}>Apply</button>
      </form>
      {canExport ? (
        <a className={`${dashButton({ variant: "secondary" })} min-h-[43px] whitespace-nowrap max-[760px]:w-full`} href={`/api/reports/export?from=${from}&to=${to}`}>
          <Download size={16} /> Export Excel
        </a>
      ) : (
        <button className={`${dashButton({ variant: "secondary" })} min-h-[43px] whitespace-nowrap max-[760px]:w-full`} type="button" disabled title="No sales in this period">
          <Download size={16} /> Export Excel
        </button>
      )}
    </section>
  );
}
