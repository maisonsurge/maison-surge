import type { Locale } from "@/i18n/config";

export type ProviderId = "mock" | "iyzico";

export type PaymentAddress = {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  district: string;
  city: string;
  postal_code?: string | null;
  country: string;
};

export type PaymentOrder = {
  id: string;
  orderNumber: string;
  grandTotal: number; // kuruş
  currency: "TRY";
  email: string;
  phone: string;
  locale: Locale;
  userId: string | null;
  createdAt: string;
  items: { id: string; sku: string; name: string; lineTotal: number; quantity: number }[];
  shippingTotal: number;
  discountTotal: number;
  shippingAddress: PaymentAddress;
  billingAddress: PaymentAddress;
  buyerIp: string;
};

export type PaymentSession = {
  /** Provider-side identifier of this attempt (mock session id / iyzico token). */
  sessionId: string;
  /** Where to send the customer (hosted payment page). */
  redirectUrl: string;
};

/** A provider event after signature / server-to-server verification. */
export type VerifiedPaymentEvent =
  | {
      kind: "succeeded";
      eventId: string;
      eventType: string;
      orderId: string;
      providerPaymentId: string;
      amount: number; // kuruş, as reported by the provider
      currency: string;
      payload: Record<string, unknown>; // sanitized, no card data
    }
  | {
      kind: "failed";
      eventId: string;
      eventType: string;
      orderId: string;
      reason: string;
      payload: Record<string, unknown>;
    };

export type RefundResult = { ok: true; providerRefundId: string } | { ok: false; error: string };

export interface PaymentProvider {
  readonly id: ProviderId;
  /** Test/sandbox mode — surfaced in the UI as "TEST". */
  readonly isTest: boolean;
  /** Credentials present and provider allowed in this environment. */
  isAvailable(): boolean;
  createSession(order: PaymentOrder, ctx: { siteUrl: string }): Promise<PaymentSession>;
  /** Verify an inbound webhook. Returns null if the signature/authenticity check fails. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent | null>;
  /** Refund API, if integrated. Absent → refunds must be executed manually in the provider panel. */
  refund?(input: { providerPaymentId: string; amount: number; currency: string; refundId: string; ip: string }): Promise<RefundResult>;
}
