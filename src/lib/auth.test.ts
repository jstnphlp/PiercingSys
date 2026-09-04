import { describe, expect, it } from "vitest";
import { hasRole, jwtSigningModeLabel } from "./auth";

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

describe("jwtSigningModeLabel", () => {
  it("distinguishes locally verifiable asymmetric tokens from symmetric tokens", () => {
    expect(jwtSigningModeLabel("ES256")).toBe("auth.jwt.asymmetric");
    expect(jwtSigningModeLabel("RS256")).toBe("auth.jwt.asymmetric");
    expect(jwtSigningModeLabel("HS256")).toBe("auth.jwt.symmetric");
    expect(jwtSigningModeLabel(undefined)).toBe("auth.jwt.unknown");
  });
});
