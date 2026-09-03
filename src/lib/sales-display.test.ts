import { describe, expect, it } from "vitest";
import {
  formatPaymentMethod,
  formatPaymentMethods,
  formatSaleItems,
} from "./sales-display";

describe("sales display formatting", () => {
  it("turns stored payment values into readable labels", () => {
    expect(formatPaymentMethod("cash")).toBe("Cash");
    expect(formatPaymentMethod("gcash")).toBe("GCash");
    expect(formatPaymentMethod("maya")).toBe("Maya");
    expect(formatPaymentMethod("bank_transfer")).toBe("Bank transfer");
    expect(formatPaymentMethod("card")).toBe("Card");
    expect(formatPaymentMethod("other")).toBe("Other");
    expect(formatPaymentMethods(["cash", "bank_transfer"])).toBe(
      "Cash, Bank transfer",
    );
    expect(formatPaymentMethods([])).toBe("—");
  });

  it("separates multiple sale items and preserves pricing status", () => {
    const value = formatSaleItems([
      { description: "Lobe", unitPriceCents: 50000 },
      { description: "Nostril", unitPriceCents: null },
    ]);

    expect(value).toContain("Lobe · ₱500");
    expect(value).toContain(", Nostril · Pricing required");
  });
});
