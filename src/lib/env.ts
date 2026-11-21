/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* values belong here.
 * Server secrets live in src/server/env.ts (guarded by "server-only").
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** Public URL of the Supabase storage host, used for next/image remotePatterns. */
export function supabaseHost(): string | null {
  try {
    return publicEnv.supabaseUrl ? new URL(publicEnv.supabaseUrl).host : null;
  } catch {
    return null;
  }
}
