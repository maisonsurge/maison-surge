"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { addCartItem, findUsableCoupon, getCart, removeCartItem, setCartCoupon, setCartItemQuantity } from "@/server/cart";
import { rateLimitByIp } from "@/server/security";
import { getDictionary } from "@/i18n";
import { asLocale } from "@/i18n/config";
import type { ActionState } from "@/lib/action-state";

const addSchema = z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(20), locale: z.string() });

export async function addToCartAction(input: { variantId: string; quantity: number; locale: string }): Promise<ActionState<{ quantity: number }>> {
  const parsed = addSchema.safeParse(input);
  const t = getDictionary(asLocale(input.locale));
  if (!parsed.success) return { ok: false, message: t.common.error };
  if (!(await rateLimitByIp("cart", 60, 60))) return { ok: false, message: t.common.rateLimited };
  const res = await addCartItem(parsed.data.variantId, parsed.data.quantity);
  if (!res.ok) return { ok: false, message: res.reason === "out_of_stock" ? t.product.outOfStock : t.cart.unavailable };
  refresh();
  return { ok: true, message: res.adjusted ? t.cart.adjusted : t.product.added, data: { quantity: res.quantity } };
}

const qtySchema = z.object({ itemId: z.uuid(), quantity: z.coerce.number().int().min(0).max(20), locale: z.string() });

export async function updateCartItemAction(formData: FormData): Promise<void> {
  const parsed = qtySchema.safeParse({ itemId: formData.get("itemId"), quantity: formData.get("quantity"), locale: formData.get("locale") });
  if (!parsed.success) return;
  await setCartItemQuantity(parsed.data.itemId, parsed.data.quantity);
  refresh();
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("itemId"));
  if (!id.success) return;
  await removeCartItem(id.data);
  refresh();
}

const couponSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/), locale: z.string() });

export async function applyCouponAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(formData.get("locale"));
  const t = getDictionary(locale);
  const parsed = couponSchema.safeParse({ code: formData.get("code"), locale });
  if (!parsed.success) return { ok: false, message: t.cart.couponInvalid };
  if (!(await rateLimitByIp("coupon", 10, 300))) return { ok: false, message: t.common.rateLimited };
  const cart = await getCart(locale);
  const subtotal = cart.lines.filter((l) => l.purchasable).reduce((n, l) => n + l.unitPrice * Math.min(l.quantity, l.available), 0);
  const coupon = await findUsableCoupon(parsed.data.code, subtotal);
  if (!coupon) return { ok: false, message: t.cart.couponInvalid };
  await setCartCoupon(coupon.code);
  refresh();
  return { ok: true, message: t.cart.couponApplied };
}

export async function removeCouponAction(): Promise<void> {
  await setCartCoupon(null);
  refresh();
}
