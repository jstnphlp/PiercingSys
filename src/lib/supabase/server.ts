import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, isServerConfigured, isSupabaseConfigured } from "@/lib/env";

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, { cookies: {
    getAll: () => cookieStore.getAll(),
    setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
  } });
}

export function createSupabaseAdminClient() {
  if (!isServerConfigured()) return null;
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}
