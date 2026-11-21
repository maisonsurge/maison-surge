import "server-only";
import { z } from "zod";
import { hmacSha256Hex, randomToken, safeEqualHex } from "@/server/security";
import { isProductionDeployment, serverEnv } from "@/server/env";
import { localePath } from "@/i18n/config";
import type { PaymentProvider, VerifiedPaymentEvent } from "./types";

/**
 * SANDBOX provider. Never moves money. The customer lands on a clearly
 * labelled "TEST" page and chooses success/failure; the server then emits an
 * HMAC-signed webhook that travels through exactly the same verification and
 * idempotent processing path a real provider webhook would.
 *
 * Signature header:  x-ms-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 */
const DEV_FALLBACK_SECRET = "dev-only-mock-webhook-secret-do-not-use-in-production";
export const MOCK_SIGNATURE_HEADER = "x-ms-signature";
const TOLERANCE_SECONDS = 300;

export function mockSecret(): string | null {
  if (serverEnv.MOCK_PAYMENT_WEBHOOK_SECRET) return serverEnv.MOCK_PAYMENT_WEBHOOK_SECRET;
  return isProductionDeployment ? null : DEV_FALLBACK_SECRET;
}

export function isMockAllowed(): boolean {
  if (!mockSecret()) return false;
  return !isProductionDeployment || serverEnv.ALLOW_MOCK_PAYMENTS_IN_PRODUCTION === "true";
}

export function signMockPayload(secret: string, rawBody: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmacSha256Hex(secret, `${timestamp}.${rawBody}`)}`;
}

export function verifyMockSignature(secret: string, rawBody: string, header: string | null, now = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1) return false;
  if (Math.abs(now - t) > TOLERANCE_SECONDS) return false;
  return safeEqualHex(hmacSha256Hex(secret, `${t}.${rawBody}`), v1);
}

export const mockEventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(8).max(100),
    type: z.literal("payment.succeeded"),
    session_id: z.string().min(8),
    order_id: z.uuid(),
    payment_id: z.string().min(4),
    amount: z.number().int().nonnegative(),
    currency: z.string().length(3),
  }),
  z.object({
    id: z.string().min(8).max(100),
    type: z.literal("payment.failed"),
    session_id: z.string().min(8),
    order_id: z.uuid(),
    reason: z.string().max(200),
  }),
]);
export type MockEvent = z.infer<typeof mockEventSchema>;

export const mockProvider: PaymentProvider = {
  id: "mock",
  isTest: true,
  isAvailable: isMockAllowed,

  async createSession(order) {
    const sessionId = `ms_${randomToken(24)}`;
    return { sessionId, redirectUrl: `${localePath(order.locale, `/checkout/sandbox/${sessionId}`)}` };
  },

  async verifyWebhook(rawBody, headers): Promise<VerifiedPaymentEvent | null> {
    const secret = mockSecret();
    if (!secret || !verifyMockSignature(secret, rawBody, headers.get(MOCK_SIGNATURE_HEADER))) return null;
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const parsed = mockEventSchema.safeParse(json);
    if (!parsed.success) return null;
    const e = parsed.data;
    if (e.type === "payment.succeeded") {
      return {
        kind: "succeeded",
        eventId: e.id,
        eventType: e.type,
        orderId: e.order_id,
        providerPaymentId: e.payment_id,
        amount: e.amount,
        currency: e.currency,
        payload: { session_id: e.session_id, test: true },
      };
    }
    return { kind: "failed", eventId: e.id, eventType: e.type, orderId: e.order_id, reason: e.reason, payload: { session_id: e.session_id, test: true } };
  },

  async refund() {
    return { ok: true, providerRefundId: `mock_rf_${randomToken(12)}` };
  },
};
