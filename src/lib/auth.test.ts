import { describe, expect, it } from "vitest";
import { hasRole } from "./auth";

describe("hasRole", () => {
  it("grants owner and manager access to management surfaces", () => {
    expect(hasRole("owner", ["owner", "manager"])).toBe(true);
    expect(hasRole("manager", ["owner", "manager"])).toBe(true);
    expect(hasRole("piercer", ["owner", "manager"])).toBe(false);
  });

  it("keeps owner-only actions exclusive", () => {
    expect(hasRole("owner", ["owner"])).toBe(true);
    expect(hasRole("manager", ["owner"])).toBe(false);
    expect(hasRole("piercer", ["owner"])).toBe(false);
  });
});
