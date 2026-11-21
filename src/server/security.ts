import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";
import { createServiceClient } from "@/server/supabase/admin";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for; first entry is the client.
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "0.0.0.0";
}

/** Salted hash so raw IP addresses are never stored. */
export function hashIdentifier(value: string): string {
  return sha256Hex(`${serverEnv.IP_HASH_SALT ?? "maison-surge-dev-salt"}:${value}`).slice(0, 32);
}

/**
 * Fixed-window rate limit backed by Postgres (works across serverless
 * instances). Fails open only if the database itself is unreachable, which is
 * logged — an outage must not lock every customer out.
 */
export async function rateLimit(bucket: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: `${bucket}:${hashIdentifier(identifier)}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[rate-limit] check failed", { bucket, error: err instanceof Error ? err.message : "unknown" });
    return true;
  }
}

export async function rateLimitByIp(bucket: string, limit: number, windowSeconds: number) {
  return rateLimit(bucket, await getClientIp(), limit, windowSeconds);
}

/**
 * CSRF defence for Route Handlers that mutate state with cookies (Server
 * Actions already verify Origin). Webhooks are exempt and use signatures.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host && o.host === host) return true;
    return o.origin === new URL(publicEnv.siteUrl).origin;
  } catch {
    return false;
  }
}

/** Honeypot + minimum fill time check for public forms. */
export function looksLikeBot(formData: FormData): boolean {
  if (String(formData.get("website") ?? "").length > 0) return true; // hidden honeypot field
  const started = Number(formData.get("_ts") ?? 0);
  if (!Number.isFinite(started) || started <= 0) return false;
  return Date.now() - started < 1500; // submitted faster than a human could
}
