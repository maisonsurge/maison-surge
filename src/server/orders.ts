import "server-only";
import { createClient } from "@/server/supabase/server";
import { createServiceClient } from "@/server/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { safeEqualHex, sha256Hex } from "@/server/security";
import type { Enums, Json } from "@/types/database.types";
import { asLocale, type Locale } from "@/i18n/config";

export type OrderAddress = {
  full_name?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  district?: string;
  city?: string;
  postal_code?: string | null;
  country?: string;
};

export type OrderBillingInfo = {
  type?: "individual" | "corporate";
  company_name?: string;
  tax_office?: string;
  tax_number?: string;
};

export type OrderViewData = {
  id: string;
  orderNumber: string;
  email: string;
  locale: Locale;
  status: Enums<"order_status">;
  paymentStatus: Enums<"payment_status">;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  vatTotal: number;
  grandTotal: number;
  refundedTotal: number;
  couponCode: string | null;
  shippingMethodName: Json;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  billingInfo: OrderBillingInfo;
  customerNote: string | null;
  createdAt: string;
  paidAt: string | null;
  reservationExpiresAt: string | null;
  isGuest: boolean;
  items: {
    id: string;
    productSlug: string | null;
    sku: string;
    name: string;
    variantLabel: string;
    imagePath: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  shipments: { id: string; carrier: string; trackingNumber: string; trackingUrl: string | null; shippedAt: string; deliveredAt: string | null }[];
  history: { id: number; toStatus: Enums<"order_status">; paymentStatus: Enums<"payment_status">; note: string | null; createdAt: string }[];
};

// Never select internal_note / guest_token_hash / idempotency_key for customers.
const ORDER_SELECT = `id, order_number, user_id, email, locale, status, payment_status, currency, subtotal, discount_total,
  shipping_total, vat_total, grand_total, refunded_total, coupon_code, shipping_method_name, shipping_address,
  billing_address, billing_info, customer_note, created_at, paid_at, reservation_expires_at,
  order_items ( id, sku, product_name, variant_label, image_path, unit_price, quantity, line_total, created_at, products ( slug ) ),
  shipments ( id, carrier, tracking_number, tracking_url, shipped_at, delivered_at ),
  order_status_history ( id, to_status, payment_status, note, is_internal, created_at )`;

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  locale: string;
  status: Enums<"order_status">;
  payment_status: Enums<"payment_status">;
  currency: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  vat_total: number;
  grand_total: number;
  refunded_total: number;
  coupon_code: string | null;
  shipping_method_name: Json;
  shipping_address: Json;
  billing_address: Json;
  billing_info: Json;
  customer_note: string | null;
  created_at: string;
  paid_at: string | null;
  reservation_expires_at: string | null;
  order_items: {
    id: string;
    sku: string;
    product_name: string;
    variant_label: string;
    image_path: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
    created_at: string;
    products: { slug: string } | null;
  }[];
  shipments: { id: string; carrier: string; tracking_number: string; tracking_url: string | null; shipped_at: string; delivered_at: string | null }[];
  order_status_history: { id: number; to_status: Enums<"order_status">; payment_status: Enums<"payment_status">; note: string | null; is_internal: boolean; created_at: string }[];
};

function asObject<T>(v: Json): T {
  return (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as T;
}

export function toOrderView(row: OrderRow): OrderViewData {
  return {
    id: row.id,
    orderNumber: row.order_number,
    email: row.email,
    locale: asLocale(row.locale),
    status: row.status,
    paymentStatus: row.payment_status,
    currency: row.currency,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    shippingTotal: row.shipping_total,
    vatTotal: row.vat_total,
    grandTotal: row.grand_total,
    refundedTotal: row.refunded_total,
    couponCode: row.coupon_code,
    shippingMethodName: row.shipping_method_name,
    shippingAddress: asObject<OrderAddress>(row.shipping_address),
    billingAddress: asObject<OrderAddress>(row.billing_address),
    billingInfo: asObject<OrderBillingInfo>(row.billing_info),
    customerNote: row.customer_note,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    reservationExpiresAt: row.reservation_expires_at,
    isGuest: row.user_id === null,
    items: [...row.order_items]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((i) => ({
        id: i.id,
        productSlug: i.products?.slug ?? null,
        sku: i.sku,
        name: i.product_name,
        variantLabel: i.variant_label,
        imagePath: i.image_path,
        unitPrice: i.unit_price,
        quantity: i.quantity,
        lineTotal: i.line_total,
      })),
    shipments: row.shipments.map((s) => ({
      id: s.id,
      carrier: s.carrier,
      trackingNumber: s.tracking_number,
      trackingUrl: s.tracking_url && s.tracking_url.startsWith("https://") ? s.tracking_url : null,
      shippedAt: s.shipped_at,
      deliveredAt: s.delivered_at,
    })),
    history: row.order_status_history
      .filter((h) => !h.is_internal)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ id: h.id, toStatus: h.to_status, paymentStatus: h.payment_status, note: null, createdAt: h.created_at })),
  };
}

const ORDER_NUMBER_RE = /^MS-\d{6}-\d{4,}$/;

export function isValidOrderNumber(value: string): boolean {
  return ORDER_NUMBER_RE.test(value);
}

/** Signed-in customer's own order (RLS: user_id = auth.uid()). */
export async function getOrderForUser(orderNumber: string): Promise<OrderViewData | null> {
  if (!isValidOrderNumber(orderNumber)) return null;
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("order_number", orderNumber).eq("user_id", user.id).maybeSingle();
  return data ? toOrderView(data as unknown as OrderRow) : null;
}

/** Constant-time check of the guest access token against the stored hash. */
export function guestTokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash || !token || token.length < 16 || token.length > 200) return false;
  return safeEqualHex(sha256Hex(token), storedHash);
}

/** Guest order via the private link token (service client, verified here). */
export async function getOrderForGuest(orderNumber: string, token: string): Promise<OrderViewData | null> {
  if (!isValidOrderNumber(orderNumber) || !token) return null;
  const db = createServiceClient();
  const { data } = await db.from("orders").select(`${ORDER_SELECT}, guest_token_hash`).eq("order_number", orderNumber).maybeSingle();
  if (!data) return null;
  const row = data as unknown as OrderRow & { guest_token_hash: string | null };
  if (!guestTokenMatches(token, row.guest_token_hash)) return null;
  return toOrderView(row);
}

/**
 * Trusted server code only (e.g. building the confirmation e-mail after a
 * verified payment). Service client, NO access check — never expose to users.
 */
export async function getOrderViewById(orderId: string): Promise<OrderViewData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const db = createServiceClient();
  const { data } = await db.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  return data ? toOrderView(data as unknown as OrderRow) : null;
}

export type OrderListItem = {
  orderNumber: string;
  createdAt: string;
  status: Enums<"order_status">;
  paymentStatus: Enums<"payment_status">;
  grandTotal: number;
  itemCount: number;
};

export async function listOrdersForUser(limit = 50): Promise<OrderListItem[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("order_number, created_at, status, payment_status, grand_total, order_items ( quantity )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((o) => ({
    orderNumber: o.order_number,
    createdAt: o.created_at,
    status: o.status,
    paymentStatus: o.payment_status,
    grandTotal: o.grand_total,
    itemCount: o.order_items.reduce((n, i) => n + i.quantity, 0),
  }));
}
