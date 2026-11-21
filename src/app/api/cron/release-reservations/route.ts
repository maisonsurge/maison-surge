import { NextResponse } from "next/server";
import { createServiceClient } from "@/server/supabase/admin";
import { serverEnv } from "@/server/env";
import { safeEqualHex, sha256Hex } from "@/server/security";

/**
 * Releases stock held by unpaid orders whose reservation expired.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Supabase pg_cron is
 * the recommended high-frequency alternative (docs/DEPLOYMENT.md).
 */
export async function GET(request: Request) {
  const secret = serverEnv.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqualHex(sha256Hex(auth), sha256Hex(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const { data, error } = await db.rpc("release_expired_reservations", { p_limit: 500 });
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ released: data });
}
