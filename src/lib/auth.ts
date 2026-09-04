import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/domain";
import {
  logServerTimingMarker,
  measureServerTiming,
  type ServerTimingLabel,
} from "@/lib/server-timing";

export type StaffSession = { userId: string; email: string; displayName: string; role: StaffRole };

export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  return measureServerTiming("auth.session.total", async () => {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data: claimsData } = await measureServerTiming(
      "auth.getClaims",
      () => supabase.auth.getClaims(),
    );
    if (claimsData?.header) {
      logServerTimingMarker(jwtSigningModeLabel(claimsData.header.alg));
    }
    const userId = claimsData?.claims.sub;
    const email = claimsData?.claims.email;
    if (typeof userId !== "string" || typeof email !== "string") return null;
    const { data } = await measureServerTiming(
      "auth.staffProfile",
      () => supabase
        .from("staff_profiles")
        .select("display_name,role,active")
        .eq("user_id", userId)
        .single(),
    );
    if (!data?.active) return null;
    return { userId, email, displayName: data.display_name, role: data.role as StaffRole };
  });
});

export function hasRole(role: StaffRole, allowed: StaffRole[]) { return allowed.includes(role); }

export function jwtSigningModeLabel(algorithm: unknown): ServerTimingLabel {
  if (typeof algorithm !== "string") return "auth.jwt.unknown";
  if (algorithm.startsWith("HS")) return "auth.jwt.symmetric";
  if (/^(ES|RS|PS|EdDSA)/.test(algorithm)) return "auth.jwt.asymmetric";
  return "auth.jwt.unknown";
}
