"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { CustomerRecord } from "@/lib/data/staff";

export function CustomerSelect({ name = "customerId", required = false }: { name?: string; required?: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const { data, isLoading } = useSWR<{ data: CustomerRecord[] }>(`/api/customers?q=${encodeURIComponent(query)}&page=1&pageSize=25`);
  return <div className="grid gap-1.5 [&_input]:w-full [&_select]:w-full">
    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" aria-label="Search clients" />
    <select name={name} required={required} aria-label="Client">
      <option value="">{required ? "Choose a client" : "Walk-in"}</option>
      {(data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}
    </select>
    {isLoading && <small>Searching…</small>}
  </div>;
}
