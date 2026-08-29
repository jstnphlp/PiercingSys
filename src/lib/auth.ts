import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/domain";

export type StaffSession = { userId: string; email: string; displayName: string; role: StaffRole };

export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from("staff_profiles").select("display_name,role,active").eq("user_id", user.id).single();
  if (!data?.active) return null;
  return { userId: user.id, email: user.email, displayName: data.display_name, role: data.role as StaffRole };
});

export function hasRole(role: StaffRole, allowed: StaffRole[]) { return allowed.includes(role); }
