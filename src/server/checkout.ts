import "server-only";
import { cookies } from "next/headers";
import { createServiceClient } from "@/server/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { getClientIp, safeEqualHex, sha256Hex } from "@/server/security";
import { getActivePaymentProvider } from "@/server/payments";
import { publicEnv } from "@/lib/env";
import { asLocale, type Locale } from "@/i18n/config";
import type { PaymentAddress, PaymentOrder } from "@/server/payments/types";

export const guestOrderCookie = (orderNumber: string) => `ms_go_${orderNumber.replace(/[^A-Z0-9-]/gi, "")}`;

export async function rememberGuestOrder(orderNumber: string, token: string) {
  (await cookies()).set(guestOrderCookie(orderNumber), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export type OrderAccess = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  reservationExpiresAt: string | null;
  locale: Locale;
  via: "user" | "guest";
  guestToken: string | null;
};

/**
 * Authorizes access to an order: the signed-in owner, or a guest holding the
 * order's secret token (query string or httpOnly cookie). Only the token's
 * SHA-256 is stored; comparison is constant-time.
 */
export async function resolveOrderAccess(orderNumber: string, tokenFromQuery?: string | null): Promise<OrderAccess | null> {
  if (!/^MS-[0-9]{6}-[0-9]{5,}$/.test(orderNumber)) return null;
  const db = createServiceClient();
  const { data: o } = await db
    .from("orders")
    .select("id, order_number, user_id, guest_token_hash, status, payment_status, grand_total, reservation_expires_at, locale")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!o) return null;
  const base = {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    paymentStatus: o.payment_status,
    grandTotal: o.grand_total,
    reservationExpiresAt: o.reservation_expires_at,
    locale: asLocale(o.locale),
  };
  const user = await getSessionUser();
  if (user && o.user_id === user.id) return { ...base, via: "user", guestToken: null };
  const token = tokenFromQuery || (await cookies()).get(guestOrderCookie(orderNumber))?.value || null;
  if (token && o.guest_token_hash && safeEqualHex(sha256Hex(token), o.guest_token_hash)) return { ...base, via: "guest", guestToken: token };
  return null;
}

export function isOrderPayable(a: Pick<OrderAccess, "status" | "paymentStatus" | "reservationExpiresAt">): boolean {
  return (
    a.status === "pending_payment" &&
    !["paid", "refunded", "partially_refunded"].includes(a.paymentStatus) &&
    (!a.reservationExpiresAt || Date.parse(a.reservationExpiresAt) > Date.now())
  );
}

async function loadPaymentOrder(orderId: string): Promise<PaymentOrder | null> {
  const db = createServiceClient();
  const { data: o } = await db
    .from("orders")
    .select("id, order_number, grand_total, email, phone, locale, user_id, created_at, shipping_total, discount_total, shipping_address, billing_address, order_items ( id, sku, product_name, variant_label, line_total, quantity )")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return null;
  return {
    id: o.id,
    orderNumber: o.order_number,
    grandTotal: o.grand_total,
    currency: "TRY",
    email: o.email,
    phone: o.phone,
    locale: asLocale(o.locale),
    userId: o.user_id,
    createdAt: o.created_at,
    items: o.order_items.map((i) => ({ id: i.id, sku: i.sku, name: [i.product_name, i.variant_label].filter(Boolean).join(" — "), lineTotal: i.line_total, quantity: i.quantity })),
    shippingTotal: o.shipping_total,
    discountTotal: o.discount_total,
    shippingAddress: o.shipping_address as unknown as PaymentAddress,
    billingAddress: o.billing_address as unknown as PaymentAddress,
    buyerIp: await getClientIp(),
  };
}

export type BeginPaymentResult = { ok: true; redirectUrl: string } | { ok: false; code: "payment_unavailable" | "order_not_payable" | "order_expired" | "generic" };

/** Creates a provider session for an order and records the attempt (start_payment). */
export async function beginPayment(orderId: string): Promise<BeginPaymentResult> {
  const provider = getActivePaymentProvider();
  if (!provider) return { ok: false, code: "payment_unavailable" };
  const order = await loadPaymentOrder(orderId);
  if (!order) return { ok: false, code: "generic" };
  let session;
  try {
    session = await provider.createSession(order, { siteUrl: publicEnv.siteUrl });
  } catch (err) {
    console.error("[checkout] provider session failed", { provider: provider.id, error: err instanceof Error ? err.message : "unknown" });
    return { ok: false, code: "payment_unavailable" };
  }
  const db = createServiceClient();
  const { error } = await db.rpc("start_payment", { p_order_id: orderId, p_provider: provider.id, p_session_id: session.sessionId, p_is_test: provider.isTest });
  if (error) {
    const code = error.message === "order_expired" ? "order_expired" : error.message === "order_not_payable" ? "order_not_payable" : "generic";
    return { ok: false, code };
  }
  return { ok: true, redirectUrl: session.redirectUrl };
}
