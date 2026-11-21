import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/server/supabase/server";
import { paymentModeInfo } from "@/server/payments";

export const dynamic = "force-dynamic";

/** Liveness + basic dependency check. Exposes no secrets or data. */
export async function GET() {
  const configured = isSupabaseConfigured();
  let db = false;
  if (configured) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from("site_settings").select("id").limit(1);
      db = !error;
    } catch {
      db = false;
    }
  }
  const payment = paymentModeInfo();
  return NextResponse.json(
    { ok: configured && db, supabaseConfigured: configured, database: db, payments: { available: payment.available, testMode: payment.isTest } },
    { status: configured && db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
