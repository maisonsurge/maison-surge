"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client (anon key, RLS). Used only to upload files to server-issued signed URLs. */
export function getBrowserSupabase() {
  client ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
