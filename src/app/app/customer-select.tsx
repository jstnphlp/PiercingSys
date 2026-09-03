"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { CustomerRecord } from "@/lib/data/staff";

type CustomerOption = { value: string; label: string };

export function CustomerSelect({ name = "customerId", required = false }: { name?: string; required?: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const { data, isLoading } = useSWR<{ data: CustomerRecord[] }>(`/api/customers?q=${encodeURIComponent(query)}&page=1&pageSize=25`);
  const options: CustomerOption[] = (data?.data ?? []).map((item) => ({ value: item.id, label: `${item.name}${item.email ? ` · ${item.email}` : ""}` }));
  return <div className="relative w-full">
    <Combobox<CustomerOption>
      name={name}
      required={required}
      items={options}
      filter={null}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      isItemEqualToValue={(item, value) => item.value === value.value}
      onInputValueChange={(value) => setSearch(value)}
    >
      <ComboboxInput
        placeholder="Search clients"
        aria-label="Search clients"
        showClear
        className="h-[42px] w-full rounded-[10px_7px_11px_8px] border-[1.5px] border-hippy-ink bg-[#fffaf0] shadow-[2px_2px_0_#d9a47e] focus-within:border-hippy-orange focus-within:ring-3 focus-within:ring-[#df682c35] [&_input]:border-0! [&_input]:bg-transparent! [&_input]:shadow-none! [&_input:focus]:outline-none!"
      />
      <ComboboxContent className="rounded-[12px_9px_13px_10px] border-[1.5px] border-hippy-ink bg-[#fffaf0] text-hippy-ink shadow-[4px_4px_0_#3b2923] ring-0">
        <ComboboxEmpty>{isLoading ? "Searching…" : "No clients found."}</ComboboxEmpty>
        <ComboboxList>{options.map((item) => <ComboboxItem className="min-h-9 rounded-lg px-2 text-[10px] font-semibold data-highlighted:bg-[#f2cf94]" key={item.value} value={item}>{item.label}</ComboboxItem>)}</ComboboxList>
      </ComboboxContent>
    </Combobox>
    {isLoading && <span className="pointer-events-none absolute top-[13px] right-12 size-3.5 animate-spin rounded-full border-2 border-[#d66335] border-t-transparent" aria-label="Searching clients" />}
  </div>;
}
