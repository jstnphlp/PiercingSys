"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatServicePrice, type Service } from "@/lib/domain";

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

  return <div className="service-table-shell">
    <Table className="service-table">
      <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Category</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
      <TableBody>{!services.length && <TableRow className="service-empty-row"><TableCell colSpan={5}>No services configured.</TableCell></TableRow>}
      {visibleServices.map((service) => <TableRow key={service.id}>
        <TableCell className="service-name" title={service.name}>{service.name}</TableCell>
        <TableCell className="capitalize">{service.category.replaceAll("_", " ")}</TableCell>
        <TableCell>{service.durationMinutes} min</TableCell>
        <TableCell><span className={`service-status ${service.isActive ? "active" : "inactive"}`}>{service.isActive ? "Active" : "Inactive"}</span></TableCell>
        <TableCell className="service-price text-right">{formatServicePrice(service)}</TableCell>
      </TableRow>)}
      {Array.from({ length: emptyRows }, (_, index) => <TableRow className="service-placeholder-row" aria-hidden="true" key={`empty-${index}`}>
        <TableCell>&nbsp;</TableCell><TableCell /><TableCell /><TableCell /><TableCell />
      </TableRow>)}</TableBody>
    </Table>
    <div className="service-table-pagination">
      <p>Showing {first}–{last} of {services.length} services</p>
      <nav aria-label="Service pages">
        <Button variant="outline" size="icon-sm" disabled={currentPage === 1} aria-label="Previous service page" onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button>
        {paginationItems(currentPage, totalPages).map((item, index) => item === "ellipsis"
          ? <span className="page-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
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
