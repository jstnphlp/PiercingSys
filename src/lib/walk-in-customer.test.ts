import { describe, expect, it } from "vitest";
import {
  customerDisplayContact,
  customerDisplayName,
  walkInCustomerFields,
} from "./walk-in-customer";

describe("walk-in customer presentation", () => {
  it("creates unique storage-safe placeholder contact details", () => {
    expect(walkInCustomerFields("  Sam  ", "customer-id")).toEqual({
      id: "customer-id",
      first_name: "Sam",
      last_name: "",
      email: "walk-in-customer-id@piercingcorner.local",
      phone: "walk-in-customer-id",
      notes: "Walk-in client created from a sale.",
    });
  });

  it("hides placeholder contact details and trims display names", () => {
    expect(customerDisplayName("Sam", "")).toBe("Sam");
    expect(customerDisplayContact(
      "walk-in-customer-id@piercingcorner.local",
      "walk-in-customer-id",
    )).toEqual({ email: "", phone: "" });
    expect(customerDisplayContact("sam@example.com", "09170000000")).toEqual({
      email: "sam@example.com",
      phone: "09170000000",
    });
  });
});
