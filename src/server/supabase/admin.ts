import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";

/**
 * Service-role client. BYPASSES RLS — only for trusted server code paths that
 * have already performed their own authorization (checkout, webhooks, carts,
 * signed uploads, cron). Never import from client components ("server-only").
 */
export function createServiceClient() {
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL are not configured");
  }
  return createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServiceSupabase = ReturnType<typeof createServiceClient>;
