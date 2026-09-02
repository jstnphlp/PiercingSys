import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, sessions } from "@/test/mocks";
import { readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient, createSupabaseAdminClient: vi.fn() }));

import { GET } from "./route";

async function loadWorkbook(response: Response) {
  const bytes = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return { workbook, archive: await JSZip.loadAsync(bytes) };
}

describe("GET /api/reports/export", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("is management-only and returns 422 for invalid ranges", async () => {
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await GET(new Request("http://localhost/api/reports/export?from=2026-09-01&to=2026-09-07"))).status).toBe(403);

    getStaffSession.mockResolvedValue(sessions.manager);
    for (const query of [
      "from=2026-02-29&to=2026-03-01",
      "from=2026-09-02&to=2026-09-01",
      "from=2024-01-01&to=2025-01-02",
    ]) {
      const { status, body } = await readJson(await GET(new Request(`http://localhost/api/reports/export?${query}`)));
      expect(status).toBe(422);
      expect(body).toMatchObject({ error: { code: "INVALID_DATES" } });
    }
  });

  it("creates a typed, filterable workbook with completed-only summaries", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const salesQuery = createQuery({ data: [
      {
        reference: "S-1", status: "completed", total_cents: 150000, created_at: "2026-08-31T16:30:00.000Z",
        customers: { first_name: "Ana", last_name: "Cruz" },
        bookings: { booking_services: [{ position: 2, name: "Nostril" }, { position: 1, name: "Lobe" }] },
        payments: [{ method: "cash", amount_cents: 100000 }, { method: "gcash", amount_cents: 50000 }],
        sale_adjustments: [{ kind: "refund", amount_cents: 25000 }],
      },
      {
        reference: "S-2", status: "void", total_cents: 50000, created_at: "2026-09-01T01:00:00.000Z",
        customers: null, bookings: null, payments: [], sale_adjustments: [],
      },
    ], error: null });
    const bookingQuery = createQuery({ data: [{ status: "completed" }, { status: "no_show" }], error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "sales" ? salesQuery : bookingQuery),
    });

    const response = await GET(new Request("http://localhost/api/reports/export?from=2026-09-01&to=2026-09-01"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toContain("piercing-corner-report-2026-09-01-2026-09-01.xlsx");
    expect(salesQuery.gte).toHaveBeenCalledWith("created_at", "2026-08-31T16:00:00.000Z");
    expect(salesQuery.lt).toHaveBeenCalledWith("created_at", "2026-09-01T16:00:00.000Z");
    expect(salesQuery.range).toHaveBeenCalledWith(0, 999);
    expect(bookingQuery.gte).toHaveBeenCalledWith("starts_at", "2026-08-31T16:00:00.000Z");

    const { workbook, archive } = await loadWorkbook(response);
    const summary = workbook.getWorksheet("Summary")!;
    const sales = workbook.getWorksheet("Sales")!;
    expect(summary.getCell("B4").value).toBe(1250);
    expect(summary.getCell("B5").value).toBe(1);
    expect(sales.getTable("SalesReport")).toBeTruthy();
    expect(sales.autoFilter).toBeUndefined();
    expect(await archive.file("xl/tables/table1.xml")!.async("string")).toContain('ref="A1:K3"');
    expect(await archive.file("xl/worksheets/sheet2.xml")!.async("string")).not.toContain("<autoFilter");
    expect(sales.getCell("A2").value).toBeInstanceOf(Date);
    expect((sales.getCell("A2").value as Date).toISOString()).toBe("2026-09-01T00:30:00.000Z");
    expect(sales.getCell("D2").value).toBe("Lobe + Nostril");
    expect(sales.getCell("F2").value).toBe(1500);
    expect(sales.getCell("G2").value).toBe(250);
    expect(sales.getCell("H2").value).toBe(1250);
    expect(sales.getCell("K2").value).toBe("cash + gcash");
    expect(sales.getCell("E3").value).toBe("void");
  });

  it("rejects exports for a period with no records", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => createQuery({ data: [], error: null })) });
    const response = await GET(new Request("http://localhost/api/reports/export?from=2026-09-01&to=2026-09-01"));
    const { status, body } = await readJson(response);
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "NO_REPORT_DATA" } });
  });

  it("rejects an appointment-only period with no sales", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => createQuery({
        data: table === "bookings" ? [{ status: "confirmed" }] : [],
        error: null,
      })),
    });
    const response = await GET(new Request("http://localhost/api/reports/export?from=2026-09-01&to=2026-09-01"));
    const { status, body } = await readJson(response);
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "NO_REPORT_DATA", message: "There are no sales to export for this period." } });
  });
});
