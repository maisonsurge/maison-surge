"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/server/supabase/admin";
import { randomToken, rateLimitByIp } from "@/server/security";
import { handlePaymentWebhook } from "@/server/payments/process";
import { isMockAllowed, MOCK_SIGNATURE_HEADER, mockSecret, signMockPayload } from "@/server/payments/mock";
import { asLocale, localePath } from "@/i18n/config";

const schema = z.object({ session: z.string().regex(/^ms_[A-Za-z0-9_-]{20,64}$/), outcome: z.enum(["succeed", "fail", "cancel"]) });

/**
 * TEST ONLY. Emits a signed mock-provider webhook and feeds it through the
 * same verification + idempotent processing path as a real webhook
 * (handlePaymentWebhook). Disabled unless the mock provider is allowed.
 */
export async function simulateMockPaymentAction(formData: FormData): Promise<void> {
  const locale = asLocale(formData.get("locale"));
  const parsed = schema.safeParse({ session: formData.get("session"), outcome: formData.get("outcome") });
  const secret = mockSecret();
  if (!parsed.success || !isMockAllowed() || !secret) redirect(localePath(locale, "/"));
  if (!(await rateLimitByIp("mock-pay", 20, 600))) redirect(localePath(locale, "/"));

  const db = createServiceClient();
  const { data: payment } = await db
    .from("payments")
    .select("id, status, amount, currency, order_id, orders ( order_number, grand_total, currency )")
    .eq("provider", "mock")
    .eq("provider_session_id", parsed.data.session)
    .maybeSingle();
  if (!payment || !payment.orders) redirect(localePath(locale, "/"));

  const target = localePath(locale, `/order/${payment.orders.order_number}`);
  if (payment.status !== "pending") redirect(target);

  const event =
    parsed.data.outcome === "succeed"
      ? {
          id: `evt_${randomToken(16)}`,
          type: "payment.succeeded" as const,
          session_id: parsed.data.session,
          order_id: payment.order_id,
          payment_id: `mock_pay_${randomToken(12)}`,
          amount: payment.orders.grand_total,
          currency: payment.orders.currency,
        }
      : {
          id: `evt_${randomToken(16)}`,
          type: "payment.failed" as const,
          session_id: parsed.data.session,
          order_id: payment.order_id,
          reason: parsed.data.outcome === "cancel" ? "cancelled_by_customer" : "card_declined_simulated",
        };
  const raw = JSON.stringify(event);
  const headers = new Headers({ [MOCK_SIGNATURE_HEADER]: signMockPayload(secret, raw), "content-type": "application/json" });
  const outcome = await handlePaymentWebhook("mock", raw, headers);
  if (outcome.status !== 200) redirect(`${target}?payment=generic`);
  redirect(target);
}
