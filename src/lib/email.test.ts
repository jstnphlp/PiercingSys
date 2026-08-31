import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, IDS } from "@/test/mocks";

const send = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({
  supabaseUrl: "http://localhost:54321",
  supabaseAnonKey: "anon",
  supabaseServiceRoleKey: "service",
  resendApiKey: "re_test" as string | undefined,
  resendFrom: "studio@example.com" as string | undefined,
  appUrl: "http://localhost:3000",
  googleOAuthEnabled: false,
}));
const createSupabaseAdminClient = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

vi.mock("@/lib/env", () => ({
  env,
  isSupabaseConfigured: () => true,
  isServerConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient,
  createSupabaseServerClient: vi.fn(),
}));

import { deliverBookingEmail } from "./email";

const booking = {
  reference: "PC-1001",
  starts_at: "2026-09-01T02:00:00.000Z",
  customers: { first_name: 'Ana <script>alert("x")</script>' },
  booking_services: [
    { position: 2, name: "Nostril & 'helix'" },
    { position: 1, name: "Lobe" },
  ],
};

function notificationClient(delivery: unknown) {
  const reads = createQuery({ data: delivery, error: null });
  const writes = createQuery({ data: { ok: true }, error: null });
  return {
    from: vi.fn()
      .mockReturnValueOnce(reads)
      .mockReturnValue(writes),
    reads,
    writes,
  };
}

describe("deliverBookingEmail", () => {
  beforeEach(() => {
    send.mockReset();
    env.resendApiKey = "re_test";
    env.resendFrom = "studio@example.com";
    createSupabaseAdminClient.mockReset();
  });

  it("does nothing without an admin client", async () => {
    createSupabaseAdminClient.mockReturnValue(null);
    await deliverBookingEmail(IDS.delivery);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips already-sent deliveries", async () => {
    const client = notificationClient({
      id: IDS.delivery,
      kind: "confirmation",
      recipient: "ana@example.com",
      status: "sent",
      attempts: 1,
      bookings: booking,
    });
    createSupabaseAdminClient.mockReturnValue(client);
    await deliverBookingEmail(IDS.delivery);
    expect(send).not.toHaveBeenCalled();
    expect(client.writes.update).not.toHaveBeenCalled();
  });

  it("records a skipped delivery when Resend is not configured", async () => {
    env.resendApiKey = undefined;
    const client = notificationClient({
      id: IDS.delivery,
      kind: "confirmation",
      recipient: "ana@example.com",
      status: "pending",
      attempts: 0,
      bookings: booking,
    });
    createSupabaseAdminClient.mockReturnValue(client);
    await deliverBookingEmail(IDS.delivery);
    expect(send).not.toHaveBeenCalled();
    expect(client.writes.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped",
      last_error: "Resend is not configured",
    }));
  });

  it("sends a confirmation with escaped customer and service names", async () => {
    send.mockResolvedValue({ data: { id: "email_1" }, error: null });
    const client = notificationClient({
      id: IDS.delivery,
      kind: "confirmation",
      recipient: "ana@example.com",
      status: "pending",
      attempts: 0,
      bookings: booking,
    });
    createSupabaseAdminClient.mockReturnValue(client);
    await deliverBookingEmail(IDS.delivery);
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0][0] as { subject: string; html: string; to: string };
    expect(payload.subject).toBe("Booking confirmed · PC-1001");
    expect(payload.to).toBe("ana@example.com");
    expect(payload.html).toContain("Lobe, Nostril &amp; &#39;helix&#39;");
    expect(payload.html).toContain("Ana &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(payload.html).not.toContain("<script>");
    expect(client.writes.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "sent",
      provider_id: "email_1",
      last_error: null,
    }));
  });

  it("marks the delivery failed when Resend returns an error", async () => {
    send.mockResolvedValue({ data: null, error: { message: "bounce" } });
    const client = notificationClient({
      id: IDS.delivery,
      kind: "cancellation",
      recipient: "ana@example.com",
      status: "pending",
      attempts: 1,
      bookings: booking,
    });
    createSupabaseAdminClient.mockReturnValue(client);
    await deliverBookingEmail(IDS.delivery);
    expect(client.writes.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      last_error: "bounce",
    }));
  });
});
