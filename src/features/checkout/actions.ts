"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { getCartSummary } from "@/server/cart";
import { getSiteSettings } from "@/server/catalog";
import { createServiceClient } from "@/server/supabase/admin";
import { createClient } from "@/server/supabase/server";
import { randomToken, rateLimitByIp, sha256Hex } from "@/server/security";
import { beginPayment, isOrderPayable, rememberGuestOrder, resolveOrderAccess } from "@/server/checkout";
import { getActivePaymentProvider } from "@/server/payments";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { getDictionary } from "@/i18n";
import { asLocale, localePath } from "@/i18n/config";
import { checkoutFormToObject, checkoutSchema } from "./schema";

const KNOWN_ERRORS = [
  "cart_empty",
  "insufficient_stock",
  "price_changed",
  "variant_unavailable",
  "coupon_invalid",
  "coupon_limit_reached",
  "shipping_method_invalid",
  "payment_unavailable",
] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];

function mapDbError(message: string | undefined): KnownError | "generic" {
  if (!message) return "generic";
  if ((KNOWN_ERRORS as readonly string[]).includes(message)) return message as KnownError;
  if (["subtotal_mismatch", "grand_total_mismatch"].includes(message)) return "price_changed";
  if (["discount_mismatch"].includes(message)) return "coupon_invalid";
  if (["shipping_total_mismatch"].includes(message)) return "shipping_method_invalid";
  return "generic";
}

/**
 * Creates the order (stock reserved in the same DB transaction) and hands the
 * customer to the payment provider. Totals are computed here and re-verified
 * by public.create_order(); payment is only marked paid by a verified webhook.
 */
export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(formData.get("locale"));
  const t = getDictionary(locale);
  const fail = (code: KnownError | "generic") => ({ ok: false, message: t.checkout.errors[code] }) satisfies ActionState;

  if (!(await rateLimitByIp("checkout", 10, 600))) return { ok: false, message: t.common.rateLimited };

  const parsed = checkoutSchema(t).safeParse(checkoutFormToObject(formData));
  if (!parsed.success) return { ok: false, message: t.validation.invalid, errors: fieldErrors(parsed.error) };
  const input = parsed.data;

  if (!getActivePaymentProvider()) return fail("payment_unavailable");

  const user = await getSessionUser();
  const email = user?.email || input.email;
  const db = createServiceClient();
  const [settings, methodRes] = await Promise.all([
    getSiteSettings(),
    db.from("shipping_methods").select("id, price, free_over, is_active").eq("id", input.shipping_method_id).eq("is_active", true).maybeSingle(),
  ]);
  const method = methodRes.data;
  if (!method) return fail("shipping_method_invalid");

  const summary = await getCartSummary(locale, { shipping: { price: method.price, free_over: method.free_over }, vatRateBps: settings?.vat_rate_bps, email });
  if (summary.lines.length === 0) return fail("cart_empty");
  if (summary.lines.some((l) => !l.purchasable || l.quantity > l.available)) return fail("insufficient_stock");
  if (summary.couponRejected) return fail("coupon_invalid");

  const guestToken = user ? null : randomToken(32);
  const billing = input.billing_same ? input.shipping : input.billing!;
  const payload = {
    idempotency_key: input.idempotency_key,
    user_id: user?.id ?? null,
    email,
    phone: input.phone,
    locale,
    cart_id: summary.id,
    items: summary.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, unit_price: l.unitPrice })),
    subtotal: summary.totals.subtotal,
    discount_total: summary.totals.discount,
    shipping_total: summary.totals.shipping,
    vat_total: summary.totals.vatIncluded,
    grand_total: summary.totals.grandTotal,
    coupon_code: summary.coupon?.code ?? null,
    shipping_method_id: method.id,
    shipping_address: { ...input.shipping },
    billing_address: { ...billing },
    billing_info:
      input.billing_type === "corporate"
        ? { type: "corporate", company_name: input.company_name, tax_office: input.tax_office, tax_number: input.tax_number }
        : { type: "individual" },
    customer_note: input.customer_note ?? null,
    guest_token_hash: guestToken ? sha256Hex(guestToken) : null,
    payment_provider: getActivePaymentProvider()?.id ?? null,
    terms_version: settings?.terms_version ?? "unknown",
  };

  const { data: created, error } = await db.rpc("create_order", { p: payload as never });
  if (error || !created) {
    console.warn("[checkout] create_order rejected", error?.message);
    return fail(mapDbError(error?.message));
  }
  const order = created as { order_id: string; order_number: string; existing: boolean };

  // A double-submitted form returns the existing order (same idempotency key).
  if (guestToken && !order.existing) await rememberGuestOrder(order.order_number, guestToken);

  if (user && input.save_address) {
    const supabase = await createClient();
    const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    await supabase.from("addresses").insert({ user_id: user.id, ...input.shipping, is_default: (count ?? 0) === 0 });
  }

  const result = await beginPayment(order.order_id);
  if (!result.ok) {
    // Order exists with reserved stock; the customer can retry from the order page.
    redirect(`${localePath(locale, `/order/${order.order_number}`)}?payment=${result.code}`);
  }
  redirect(result.redirectUrl);
}

/** Retry payment for an existing, still-payable order (owner or guest token holder). */
export async function retryPaymentAction(formData: FormData): Promise<void> {
  const locale = asLocale(formData.get("locale"));
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const access = await resolveOrderAccess(orderNumber, String(formData.get("t") ?? "") || null);
  if (!access) redirect(localePath(locale, "/"));
  if (!(await rateLimitByIp("payment-retry", 10, 600))) redirect(`${localePath(locale, `/order/${orderNumber}`)}?payment=rate_limited`);
  if (!isOrderPayable(access)) redirect(`${localePath(locale, `/order/${orderNumber}`)}?payment=order_not_payable`);
  const result = await beginPayment(access.id);
  if (!result.ok) redirect(`${localePath(locale, `/order/${orderNumber}`)}?payment=${result.code}`);
  redirect(result.redirectUrl);
}
