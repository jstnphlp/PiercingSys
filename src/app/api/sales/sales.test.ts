import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS, sessions } from "@/test/mocks";
import { jsonRequest, readJson } from "@/test/http";

const getStaffSession = vi.hoisted(() => vi.fn());
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getStaffSession,
  hasRole: (role: string, allowed: string[]) => allowed.includes(role),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
  createSupabaseAdminClient: vi.fn(),
}));

import { POST as createSale } from "./route";
import { PATCH as patchSale } from "./[id]/route";
import { POST as adjustSale } from "./[id]/adjustments/route";

const saleBody = {
  customerId: IDS.customer,
  items: [{
    type: "service",
    sourceId: IDS.service,
    description: "Lobe",
    quantity: 1,
    unitPriceCents: 50000,
  }],
  payments: [{ method: "cash", amountCents: 50000 }],
  complete: true,
};

const params = { params: Promise.resolve({ id: IDS.sale }) };

describe("POST /api/sales", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("blocks anonymous and piercer access", async () => {
    getStaffSession.mockResolvedValue(null);
    expect((await readJson(await createSale(jsonRequest("http://localhost/api/sales", saleBody)))).status).toBe(401);
    getStaffSession.mockResolvedValue(sessions.piercer);
    expect((await readJson(await createSale(jsonRequest("http://localhost/api/sales", saleBody)))).status).toBe(403);
  });

  it("rejects a sale with no items", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const { status } = await readJson(await createSale(jsonRequest("http://localhost/api/sales", {
      ...saleBody,
      items: [],
    })));
    expect(status).toBe(422);
  });

  it("requires and records a named client for a walk-in sale", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const invalid = await readJson(await createSale(jsonRequest("http://localhost/api/sales", {
      ...saleBody,
      customerId: null,
    })));
    expect(invalid.status).toBe(422);

    const customer = createQuery({ data: { id: IDS.customer }, error: null });
    const rpc = vi.fn(async () => ({
      data: [{ id: IDS.sale, reference: "S-1", total_cents: 50000, balance_cents: 0 }],
      error: null,
    }));
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => customer),
      rpc,
    });
    const created = await readJson(await createSale(jsonRequest("http://localhost/api/sales", {
      ...saleBody,
      customerId: null,
      walkInName: " Kai Rivera ",
    })));

    expect(created.status).toBe(201);
    expect(customer.insert).toHaveBeenCalledWith(expect.objectContaining({
      first_name: "Kai Rivera",
      last_name: "",
      email: expect.stringMatching(/^walk-in-.+@piercingcorner\.local$/),
      phone: expect.stringMatching(/^walk-in-/),
    }));
    expect(rpc).toHaveBeenCalledWith("create_sale", expect.objectContaining({
      p_customer_id: IDS.customer,
    }));
  });

  it("maps database business errors to API codes", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const cases = [
      ["not_authorized", 403, "FORBIDDEN"],
      ["balance_due", 422, "BALANCE_DUE"],
      ["invalid_service_price", 422, "INVALID_SERVICE_PRICE"],
      ["service_required", 422, "SERVICE_REQUIRED"],
      ["connection failed", 400, "CREATE_FAILED"],
    ] as const;
    for (const [message, status, code] of cases) {
      createSupabaseServerClient.mockResolvedValue({
        rpc: vi.fn(async () => ({ data: null, error: { message } })),
      });
      const result = await readJson(await createSale(jsonRequest("http://localhost/api/sales", saleBody)));
      expect(result.status, message).toBe(status);
      expect(result.body, message).toMatchObject({ error: { code } });
    }
  });

  it("returns the created sale totals", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    createSupabaseServerClient.mockResolvedValue({
      rpc: vi.fn(async () => ({
        data: [{ id: IDS.sale, reference: "S-1", total_cents: 50000, balance_cents: 0 }],
        error: null,
      })),
    });
    const { status, body } = await readJson(await createSale(jsonRequest("http://localhost/api/sales", saleBody)));
    expect(status).toBe(201);
    expect(body).toEqual({
      data: { id: IDS.sale, reference: "S-1", totalCents: 50000, balanceCents: 0 },
    });
  });
});

describe("PATCH /api/sales/:id", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("refuses edits to a completed sale", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: { id: IDS.sale, status: "completed", total_cents: 50000, payments: [] }, error: null })),
    });
    const { status, body } = await readJson(await patchSale(
      jsonRequest("http://localhost/api/sales/x", { action: "complete" }),
      params,
    ));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "SALE_NOT_DRAFT" } });
  });

  it("rejects a price outside the snapshotted range", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "sales") {
          return createQuery({ data: { id: IDS.sale, status: "draft", total_cents: 0, payments: [] }, error: null });
        }
        return createQuery({
          data: { id: IDS.item, min_price_cents: 20000, max_price_cents: 35000, unit_price_cents: null },
          error: null,
        });
      }),
    });
    const { status, body } = await readJson(await patchSale(
      jsonRequest("http://localhost/api/sales/x", { action: "resolve_price", itemId: IDS.item, unitPriceCents: 19999 }),
      params,
    ));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "PRICE_OUT_OF_RANGE" } });
  });

  it("blocks overpayment against the remaining balance", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({
        data: { id: IDS.sale, status: "draft", total_cents: 50000, payments: [{ amount_cents: 40000 }] },
        error: null,
      })),
    });
    const { status, body } = await readJson(await patchSale(
      jsonRequest("http://localhost/api/sales/x", { action: "add_payment", method: "cash", amountCents: 10001 }),
      params,
    ));
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: { code: "OVERPAYMENT" } });
  });

  it("maps incomplete pricing and unpaid balances on completion", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({
        data: { id: IDS.sale, status: "draft", total_cents: 50000, payments: [] },
        error: null,
      })),
      rpc: vi.fn(async () => ({ data: null, error: { message: "pricing_required" } })),
    });
    const pricing = await readJson(await patchSale(
      jsonRequest("http://localhost/api/sales/x", { action: "complete" }),
      params,
    ));
    expect(pricing.status).toBe(422);
    expect(pricing.body).toMatchObject({
      error: { code: "COMPLETION_FAILED", message: "Set every service price before completing the sale." },
    });
  });

  it("records a payment that does not exceed the total", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    const payments = createQuery({ data: { id: "pay" }, error: null });
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "payments"
        ? payments
        : createQuery({
          data: { id: IDS.sale, status: "draft", total_cents: 50000, payments: [{ amount_cents: 20000 }] },
          error: null,
        })),
      rpc,
    });
    const { status } = await readJson(await patchSale(
      jsonRequest("http://localhost/api/sales/x", { action: "add_payment", method: "gcash", amountCents: 30000 }),
      params,
    ));
    expect(status).toBe(200);
    expect(payments.insert).toHaveBeenCalledWith(expect.objectContaining({
      method: "gcash",
      amount_cents: 30000,
      received_by: IDS.manager,
    }));
    expect(rpc).toHaveBeenCalledWith("complete_draft_sale", { p_sale_id: IDS.sale });
  });
});

describe("POST /api/sales/:id/adjustments", () => {
  beforeEach(() => {
    getStaffSession.mockReset();
    createSupabaseServerClient.mockReset();
  });

  it("only adjusts completed sales and never exceeds the original total", async () => {
    getStaffSession.mockResolvedValue(sessions.manager);
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ data: { id: IDS.sale, status: "draft", total_cents: 50000, sale_adjustments: [] }, error: null })),
    });
    expect((await readJson(await adjustSale(
      jsonRequest("http://localhost/api/sales/x/adjustments", { kind: "refund", amountCents: 1000, reason: "test" }),
      params,
    ))).status).toBe(422);

    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => createQuery({
        data: { id: IDS.sale, status: "completed", total_cents: 50000, sale_adjustments: [{ amount_cents: 40000 }] },
        error: null,
      })),
    });
    const excess = await readJson(await adjustSale(
      jsonRequest("http://localhost/api/sales/x/adjustments", { kind: "refund", amountCents: 10001, reason: "too much" }),
      params,
    ));
    expect(excess.status).toBe(422);
    expect(excess.body).toMatchObject({ error: { code: "EXCESS_ADJUSTMENT" } });
  });

  it("appends a refund for management", async () => {
    getStaffSession.mockResolvedValue(sessions.owner);
    const insert = createQuery({ data: { id: "adj-1" }, error: null });
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "sale_adjustments"
        ? insert
        : createQuery({
          data: { id: IDS.sale, status: "completed", total_cents: 50000, sale_adjustments: [] },
          error: null,
        })),
    });
    const { status, body } = await readJson(await adjustSale(
      jsonRequest("http://localhost/api/sales/x/adjustments", { kind: "refund", amountCents: 25000, reason: "Guest changed jewelry" }),
      params,
    ));
    expect(status).toBe(201);
    expect(body).toEqual({ data: { id: "adj-1" } });
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      kind: "refund",
      amount_cents: 25000,
      actor_id: IDS.owner,
    }));
  });
});
