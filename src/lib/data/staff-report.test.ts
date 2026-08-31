import { describe, expect, it, vi } from "vitest";
import { resolveReportPeriod } from "@/lib/report-period";

const createSupabaseServerClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

import { getStaffData } from "./staff";

describe("report data loading", () => {
  it("passes the same inclusive Manila UTC boundaries to the reporting RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { revenue_cents: 125000, completed_sales: 1, sale_count: 2, booking_count: 2, booking_statuses: { completed: 2 }, methods: { cash: 125000 } },
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({ rpc });
    const period = resolveReportPeriod({ period: "custom", from: "2026-09-01", to: "2026-09-07" });

    const data = await getStaffData("reports", period);

    expect(rpc).toHaveBeenCalledWith("studio_report", { p_start: period.startUtc, p_end: period.endUtc });
    expect(data).toMatchObject({ completedRevenueCents: 125000, completedSaleCount: 1, reportSaleCount: 2, reportBookingCount: 2 });
  });
});
