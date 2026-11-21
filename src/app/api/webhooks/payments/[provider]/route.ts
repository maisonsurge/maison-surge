import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/server/payments/process";

/**
 * Provider → server webhook. Raw body is read as text so the signature is
 * verified over the exact bytes sent. Not covered by the proxy matcher and
 * exempt from origin checks (authenticated by signature instead).
 * Idempotent: redeliveries return 200 with result "duplicate_event".
 */
export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/payments/[provider]">) {
  const { provider } = await ctx.params;
  const raw = await request.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const outcome = await handlePaymentWebhook(provider, raw, request.headers);
  return NextResponse.json({ received: outcome.status === 200, result: outcome.result }, { status: outcome.status });
}
