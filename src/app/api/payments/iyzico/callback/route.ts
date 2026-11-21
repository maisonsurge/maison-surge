import { NextResponse } from "next/server";
import { iyzicoProvider } from "@/server/payments/iyzico";
import { applyVerifiedEvent } from "@/server/payments/process";
import { createServiceClient } from "@/server/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * iyzico Checkout Form callback (browser POST with `token`). The token is only
 * a lookup key: the result is fetched server-to-server and processed
 * idempotently (event id `checkout:<token>`). UNVERIFIED without iyzico
 * sandbox credentials — see docs/RELEASE_CHECKLIST.md.
 */
export async function POST(request: Request) {
  const home = `${publicEnv.siteUrl}/tr`;
  if (!iyzicoProvider.isAvailable()) return NextResponse.redirect(home, 303);
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string") return NextResponse.redirect(home, 303);

  let orderId: string | null = null;
  try {
    const event = await iyzicoProvider.verifyToken(token);
    if (event) {
      orderId = event.orderId;
      await applyVerifiedEvent("iyzico", event);
    }
  } catch (err) {
    console.error("[iyzico] callback processing failed", err instanceof Error ? err.message : "unknown");
  }
  if (!orderId) return NextResponse.redirect(home, 303);
  const db = createServiceClient();
  const { data } = await db.from("orders").select("order_number, locale").eq("id", orderId).maybeSingle();
  if (!data) return NextResponse.redirect(home, 303);
  return NextResponse.redirect(`${publicEnv.siteUrl}/${data.locale}/order/${data.order_number}`, 303);
}
