import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { env, isServerConfigured, isSupabaseConfigured } from "@/lib/env";

export const createSupabaseServerClient = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, { cookies: {
    getAll: () => cookieStore.getAll(),
    setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
  } });
});

function buildAdminClient() {
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type AdminClient = ReturnType<typeof buildAdminClient>;
const globalForSupabase = globalThis as typeof globalThis & {
  piercingCornerAdminClient?: AdminClient;
};

export function createSupabaseAdminClient() {
  if (!isServerConfigured()) return null;
  if (!globalForSupabase.piercingCornerAdminClient) {
    globalForSupabase.piercingCornerAdminClient = buildAdminClient();
  }
  return globalForSupabase.piercingCornerAdminClient;
}
