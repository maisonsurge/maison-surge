import type { Kurus } from "./money";

/**
 * Single TypeScript implementation of order totals. The database function
 * public.create_order() re-validates every number inside the order
 * transaction (same formulas — see compute_coupon_discount in migration 0600),
 * so a tampered or stale client can never create an order with wrong totals.
 */
export type CouponRule = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
};

export type ShippingRule = { price: Kurus; free_over: Kurus | null };

export type PricingInput = {
  lines: { unitPrice: Kurus; quantity: number }[];
  coupon?: CouponRule | null;
  shipping?: ShippingRule | null;
  vatRateBps?: number | null;
};

export type Totals = {
  subtotal: Kurus;
  discount: Kurus;
  shipping: Kurus;
  vatIncluded: Kurus;
  grandTotal: Kurus;
  freeShippingRemaining: Kurus | null;
};

const INT_MAX = 2_147_483_647;

export function computeCouponDiscount(coupon: CouponRule, subtotal: Kurus): Kurus {
  if (subtotal < coupon.min_subtotal) return 0;
  const cap = coupon.max_discount ?? INT_MAX;
  const raw = coupon.type === "percent" ? Math.min(Math.floor((subtotal * coupon.value) / 100), cap) : Math.min(coupon.value, cap);
  return Math.max(0, Math.min(subtotal, raw));
}

export function computeShipping(rule: ShippingRule, discountedSubtotal: Kurus): Kurus {
  return rule.free_over !== null && discountedSubtotal >= rule.free_over ? 0 : rule.price;
}

export function computeTotals(input: PricingInput): Totals {
  let subtotal = 0;
  for (const l of input.lines) {
    if (!Number.isSafeInteger(l.unitPrice) || l.unitPrice < 0) throw new Error("invalid unit price");
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new Error("invalid quantity");
    subtotal += l.unitPrice * l.quantity;
  }
  const discount = input.coupon ? computeCouponDiscount(input.coupon, subtotal) : 0;
  const discounted = subtotal - discount;
  const shipping = input.shipping ? computeShipping(input.shipping, discounted) : 0;
  const grandTotal = discounted + shipping;
  const rate = input.vatRateBps ?? null;
  // Prices are VAT-inclusive; the VAT share is informational only.
  const vatIncluded = rate && rate > 0 ? Math.round((grandTotal * rate) / (10_000 + rate)) : 0;
  const freeShippingRemaining =
    input.shipping && input.shipping.free_over !== null && discounted < input.shipping.free_over
      ? input.shipping.free_over - discounted
      : null;
  return { subtotal, discount, shipping, vatIncluded, grandTotal, freeShippingRemaining };
}
