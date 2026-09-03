"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatServicePrice, type Service } from "@/lib/domain";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function ServiceList({ services }: { services: Service[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const visibleServices = useMemo(
    () => services.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, services],
  );
  const first = services.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(currentPage * PAGE_SIZE, services.length);
  const emptyRows = PAGE_SIZE - visibleServices.length - (services.length ? 0 : 1);

  return <div className="mx-[18px] mt-3 overflow-hidden rounded-xl border border-hippy-ink bg-[#fff9eb] max-[760px]:mx-2.5">
    <Table className="table-fixed [&_th]:bg-[#f5ddba] [&_th]:text-[8px] [&_th]:font-black [&_th]:tracking-[.5px] [&_th]:text-[#795346] [&_th]:uppercase [&_td]:h-[52px] [&_td]:border-dashed [&_td]:border-[#dab08f] [&_td]:text-[10px]">
      <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Category</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
      <TableBody>{!services.length && <TableRow><TableCell className="text-center text-studio-muted" colSpan={5}>No services configured.</TableCell></TableRow>}
      {visibleServices.map((service) => <TableRow key={service.id}>
        <TableCell className="overflow-hidden font-bold text-ellipsis whitespace-nowrap" title={service.name}>{service.name}</TableCell>
        <TableCell className="capitalize">{service.category.replaceAll("_", " ")}</TableCell>
        <TableCell>{service.durationMinutes} min</TableCell>
        <TableCell><span className={cn("inline-flex rounded-full border px-2 py-1 text-[8px] font-black", service.isActive ? "border-[#4a6d5b] bg-[#c8dfc6] text-[#315342]" : "border-[#9a4734] bg-[#f0c0ad] text-[#783321]")}>{service.isActive ? "Active" : "Inactive"}</span></TableCell>
        <TableCell className="text-right font-bold">{formatServicePrice(service)}</TableCell>
      </TableRow>)}
      {Array.from({ length: emptyRows }, (_, index) => <TableRow className="h-[52px]" aria-hidden="true" key={`empty-${index}`}>
        <TableCell>&nbsp;</TableCell><TableCell /><TableCell /><TableCell /><TableCell />
      </TableRow>)}</TableBody>
    </Table>
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-dashed border-[#d6a786] px-3 py-2 text-[9px] max-[760px]:flex-col max-[760px]:items-start [&>p]:m-0 [&>nav]:flex [&>nav]:items-center [&>nav]:gap-1 max-[760px]:[&>nav]:self-stretch max-[760px]:[&>nav]:justify-end">
      <p>Showing {first}–{last} of {services.length} services</p>
      <nav aria-label="Service pages">
        <Button variant="outline" size="icon-sm" disabled={currentPage === 1} aria-label="Previous service page" onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
        {paginationItems(currentPage, totalPages).map((item, index) => item === "ellipsis"
          ? <span className="px-1" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
          : <Button key={item} variant={item === currentPage ? "default" : "outline"} size="icon-sm" aria-label={`Service page ${item}`} aria-current={item === currentPage ? "page" : undefined} onClick={() => setPage(item)}>{item}</Button>)}
        <Button variant="outline" size="icon-sm" disabled={currentPage === totalPages} aria-label="Next service page" onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button>
      </nav>
    </div>
  </div>;
}

function paginationItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, 4, "ellipsis", total];
  if (current >= total - 2) return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}
