import "server-only";
import { createServiceClient } from "@/server/supabase/admin";
import { getProviderById } from "./index";
import type { VerifiedPaymentEvent } from "./types";

export type WebhookOutcome =
  | { status: 200; result: string }
  | { status: 400; result: "invalid_signature" | "unknown_provider" }
  | { status: 500; result: "processing_error" };

/**
 * Applies a VERIFIED provider event. All state changes happen inside the
 * confirm_payment / fail_payment SQL functions, which are idempotent on
 * (provider, event_id) and lock the order row.
 */
export async function applyVerifiedEvent(providerId: string, event: VerifiedPaymentEvent): Promise<string> {
  const db = createServiceClient();
  if (event.kind === "succeeded") {
    const { data, error } = await db.rpc("confirm_payment", {
      p_provider: providerId,
      p_event_id: event.eventId,
      p_event_type: event.eventType,
      p_order_id: event.orderId,
      p_provider_payment_id: event.providerPaymentId,
      p_amount: event.amount,
      p_currency: event.currency,
      p_payload: event.payload as never,
    });
    if (error) throw new Error(error.message);
    if (data === "confirmed" || data === "confirmed_after_expiry") {
      await notifyOrderConfirmed(event.orderId).catch((err: unknown) =>
        console.error("[payments] confirmation email failed", err instanceof Error ? err.message : "unknown"),
      );
    }
    return data;
  }
  const { data, error } = await db.rpc("fail_payment", {
    p_provider: providerId,
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_order_id: event.orderId,
    p_reason: event.reason,
    p_payload: event.payload as never,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Entry point for webhook route handlers (raw body is required for signatures). */
export async function handlePaymentWebhook(providerId: string, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  const provider = getProviderById(providerId);
  if (!provider || !provider.isAvailable()) return { status: 400, result: "unknown_provider" };
  let event: VerifiedPaymentEvent | null;
  try {
    event = await provider.verifyWebhook(rawBody, headers);
  } catch (err) {
    console.error("[payments] verification error", { provider: providerId, error: err instanceof Error ? err.message : "unknown" });
    return { status: 500, result: "processing_error" };
  }
  if (!event) {
    console.warn("[payments] rejected webhook: invalid signature or payload", { provider: providerId });
    return { status: 400, result: "invalid_signature" };
  }
  try {
    const result = await applyVerifiedEvent(providerId, event);
    console.info("[payments] event processed", { provider: providerId, event: event.eventId.slice(0, 24), result });
    return { status: 200, result };
  } catch (err) {
    console.error("[payments] processing error", { provider: providerId, error: err instanceof Error ? err.message : "unknown" });
    return { status: 500, result: "processing_error" };
  }
}

async function notifyOrderConfirmed(orderId: string) {
  const { sendEmail, orderConfirmationEmail } = await import("@/server/email");
  const { getOrderViewById } = await import("@/server/orders");
  const order = await getOrderViewById(orderId);
  if (!order) return;
  const mail = orderConfirmationEmail(order, order.locale);
  await sendEmail({ to: order.email, ...mail });
}
