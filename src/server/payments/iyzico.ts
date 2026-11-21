import "server-only";
import { randomInt } from "node:crypto";
import { hmacSha256Hex } from "@/server/security";
import { serverEnv } from "@/server/env";
import { createServiceClient } from "@/server/supabase/admin";
import { parseMoneyInput, toDecimalString } from "@/lib/money";
import type { PaymentOrder, PaymentProvider, VerifiedPaymentEvent } from "./types";

/**
 * iyzico Checkout Form adapter.
 *
 * STATUS: implemented against iyzico's documented API shape but NOT verified
 * with real sandbox credentials (none were provided). Before enabling
 * (PAYMENT_PROVIDER=iyzico) follow docs/RELEASE_CHECKLIST.md → "Ödeme".
 *
 * Trust model: inbound callbacks/webhooks are treated only as a *trigger*.
 * The payment result is always fetched server-to-server from iyzico's
 * "retrieve checkout form" endpoint with our signed credentials, and the
 * order is resolved from OUR payments table by the session token — never from
 * values in the inbound request. Idempotency key: `checkout:<token>`.
 *
 * Refund API is intentionally not integrated yet → refunds are executed in the
 * iyzico merchant panel and confirmed in admin ("manual refund").
 */
const INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

function isSandbox() {
  return serverEnv.IYZICO_BASE_URL.includes("sandbox");
}

function authHeaders(path: string, body: string) {
  const apiKey = serverEnv.IYZICO_API_KEY ?? "";
  const secret = serverEnv.IYZICO_SECRET_KEY ?? "";
  const randomKey = `${Date.now()}${randomInt(100000, 999999)}`;
  const signature = hmacSha256Hex(secret, randomKey + path + body);
  const auth = Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString("base64");
  return { Authorization: `IYZWSv2 ${auth}`, "x-iyzi-rnd": randomKey, "Content-Type": "application/json", Accept: "application/json" };
}

async function call<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const body = JSON.stringify(payload);
  const res = await fetch(`${serverEnv.IYZICO_BASE_URL}${path}`, { method: "POST", headers: authHeaders(path, body), body, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as T & { status?: string; errorMessage?: string; errorCode?: string };
  if (!res.ok || json.status !== "success") {
    throw new Error(`iyzico_error:${json.errorCode ?? res.status}`);
  }
  return json;
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts.pop()! : parts[0]!;
  return { name: parts.join(" ") || surname, surname };
}

function iyzicoAddress(a: PaymentOrder["shippingAddress"]) {
  return {
    contactName: a.full_name,
    city: a.city,
    country: "Turkey",
    address: [a.line1, a.line2, a.district].filter(Boolean).join(", "),
    zipCode: a.postal_code ?? undefined,
  };
}

/** Distributes the order-level discount across lines with integer math so Σ items = grand total. */
export function buildBasket(order: Pick<PaymentOrder, "items" | "discountTotal" | "shippingTotal">) {
  const subtotal = order.items.reduce((n, i) => n + i.lineTotal, 0);
  let remaining = order.discountTotal;
  const lines = order.items.map((item, idx) => {
    const isLast = idx === order.items.length - 1;
    const share = isLast ? remaining : Math.floor((order.discountTotal * item.lineTotal) / Math.max(subtotal, 1));
    remaining -= share;
    return { id: item.sku, name: item.name, amount: item.lineTotal - share };
  });
  if (order.shippingTotal > 0) lines.push({ id: "SHIPPING", name: "Kargo", amount: order.shippingTotal });
  return lines.filter((l) => l.amount > 0);
}

type InitResponse = { token: string; paymentPageUrl: string };
type RetrieveResponse = {
  paymentStatus?: string;
  fraudStatus?: number;
  paymentId?: string;
  paidPrice?: number | string;
  currency?: string;
  basketId?: string;
  errorMessage?: string;
};

export const iyzicoProvider: PaymentProvider & { verifyToken(token: string): Promise<VerifiedPaymentEvent | null> } = {
  id: "iyzico",
  get isTest() {
    return isSandbox();
  },

  isAvailable() {
    return Boolean(serverEnv.IYZICO_API_KEY && serverEnv.IYZICO_SECRET_KEY);
  },

  async createSession(order, { siteUrl }) {
    if (order.grandTotal <= 0) throw new Error("iyzico_zero_amount");
    const basket = buildBasket(order);
    const total = toDecimalString(order.grandTotal);
    const { name, surname } = splitName(order.billingAddress.full_name);
    const res = await call<InitResponse>(INIT_PATH, {
      locale: order.locale === "en" ? "en" : "tr",
      conversationId: order.id,
      price: total,
      paidPrice: total,
      currency: "TRY",
      basketId: order.orderNumber,
      paymentGroup: "PRODUCT",
      callbackUrl: `${siteUrl}/api/payments/iyzico/callback`,
      buyer: {
        id: order.userId ?? `guest-${order.id}`,
        name,
        surname,
        email: order.email,
        gsmNumber: order.phone.replace(/[^\d+]/g, ""),
        // TCKN is not collected (D-020). iyzico requires the field; the business
        // must confirm the acceptable value with iyzico before going live.
        identityNumber: "11111111111",
        registrationAddress: iyzicoAddress(order.billingAddress).address,
        city: order.billingAddress.city,
        country: "Turkey",
        zipCode: order.billingAddress.postal_code ?? undefined,
        ip: order.buyerIp,
      },
      shippingAddress: iyzicoAddress(order.shippingAddress),
      billingAddress: iyzicoAddress(order.billingAddress),
      basketItems: basket.map((b) => ({ id: b.id, name: b.name.slice(0, 100), category1: "Giyim", itemType: "PHYSICAL", price: toDecimalString(b.amount) })),
    });
    return { sessionId: res.token, redirectUrl: res.paymentPageUrl };
  },

  /** Server-to-server verification of a checkout token. */
  async verifyToken(token: string): Promise<VerifiedPaymentEvent | null> {
    if (!/^[A-Za-z0-9-]{10,200}$/.test(token)) return null;
    const db = createServiceClient();
    const { data: payment } = await db.from("payments").select("order_id").eq("provider", "iyzico").eq("provider_session_id", token).maybeSingle();
    if (!payment) return null;
    const r = await call<RetrieveResponse>(RETRIEVE_PATH, { locale: "tr", conversationId: payment.order_id, token });
    const eventId = `checkout:${token}`;
    if (r.paymentStatus === "SUCCESS" && r.fraudStatus === 1 && r.paymentId) {
      const amount = parseMoneyInput(String(r.paidPrice ?? ""));
      if (amount === null) return null;
      return {
        kind: "succeeded",
        eventId,
        eventType: "checkoutform.retrieve",
        orderId: payment.order_id,
        providerPaymentId: r.paymentId,
        amount,
        currency: r.currency ?? "TRY",
        payload: { basketId: r.basketId ?? null, fraudStatus: r.fraudStatus ?? null },
      };
    }
    return {
      kind: "failed",
      eventId,
      eventType: "checkoutform.retrieve",
      orderId: payment.order_id,
      reason: r.fraudStatus !== undefined && r.fraudStatus !== 1 ? "fraud_review_or_rejected" : (r.errorMessage ?? "payment_failed").slice(0, 200),
      payload: { paymentStatus: r.paymentStatus ?? null, fraudStatus: r.fraudStatus ?? null },
    };
  },

  async verifyWebhook(rawBody) {
    // Treat the inbound body only as a trigger; re-verify with the retrieve API.
    let token: string | null = null;
    try {
      const json = JSON.parse(rawBody) as Record<string, unknown>;
      token = typeof json.token === "string" ? json.token : null;
    } catch {
      token = new URLSearchParams(rawBody).get("token");
    }
    return token ? iyzicoProvider.verifyToken(token) : null;
  },
};
