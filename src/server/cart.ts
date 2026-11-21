import "server-only";
import { cookies } from "next/headers";
import { createServiceClient, type ServiceSupabase } from "@/server/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { randomToken, sha256Hex } from "@/server/security";
import { computeTotals, type CouponRule, type Totals } from "@/lib/pricing";
import { pickLocale } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/i18n/config";

/**
 * Carts live in Postgres and are only touched by this module (service role),
 * always scoped to either the signed-in user's id or the SHA-256 hash of the
 * guest's httpOnly cookie token. Prices are never stored in the cart; they are
 * read fresh from the catalog every time.
 *
 * Merge policy (docs/DECISIONS.md D-007): on sign-in the guest cart is merged
 * into the user's cart; quantities are summed and capped at available stock
 * and the 20-per-line limit; the guest cart is then deleted.
 */
export const CART_COOKIE = "ms_cart";
export const MAX_LINE_QTY = 20;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

async function readGuestTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token && token.length >= 32 ? sha256Hex(token) : null;
}

async function findCartId(db: ServiceSupabase): Promise<string | null> {
  const user = await getSessionUser();
  if (user) {
    const { data } = await db.from("carts").select("id").eq("user_id", user.id).maybeSingle();
    return data?.id ?? null;
  }
  const hash = await readGuestTokenHash();
  if (!hash) return null;
  const { data } = await db.from("carts").select("id").eq("token_hash", hash).is("user_id", null).maybeSingle();
  return data?.id ?? null;
}

/** Must be called from a Server Action / Route Handler (may set a cookie). */
async function getOrCreateCartId(db: ServiceSupabase): Promise<string> {
  const existing = await findCartId(db);
  if (existing) return existing;
  const user = await getSessionUser();
  if (user) {
    const { data, error } = await db.from("carts").insert({ user_id: user.id }).select("id").single();
    if (error) {
      // concurrent creation — read again
      const { data: again } = await db.from("carts").select("id").eq("user_id", user.id).single();
      if (again) return again.id;
      throw error;
    }
    return data.id;
  }
  const token = randomToken(32);
  const { data, error } = await db.from("carts").insert({ token_hash: sha256Hex(token) }).select("id").single();
  if (error) throw error;
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return data.id;
}

export type CartLine = {
  itemId: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  sizeLabel: string;
  colorName: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  available: number;
  purchasable: boolean;
  imagePath: string | null;
  imageAlt: string;
};

export type CartView = {
  id: string | null;
  couponCode: string | null;
  lines: CartLine[];
  count: number;
};

const CART_SELECT = `id, coupon_code,
  cart_items ( id, quantity, variant_id, created_at,
    product_variants ( id, sku, price, compare_at_price, stock_on_hand, stock_reserved, is_active, color_id,
      sizes ( code, label ), colors ( code, name ),
      products ( id, slug, status, base_price, compare_at_price,
        product_translations ( locale, name ),
        product_images ( path, alt, is_cover, position, color_id ) ) ) )`;

async function loadCart(db: ServiceSupabase, cartId: string, locale: Locale): Promise<CartView> {
  const { data } = await db.from("carts").select(CART_SELECT).eq("id", cartId).maybeSingle();
  if (!data) return { id: null, couponCode: null, lines: [], count: 0 };
  const lines: CartLine[] = [...data.cart_items]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((item) => {
      const v = item.product_variants;
      const p = v?.products;
      if (!v || !p) return [];
      const t = p.product_translations.find((x) => x.locale === locale) ?? p.product_translations.find((x) => x.locale === "tr");
      const imgs = [...p.product_images].sort(
        (a, b) =>
          Number(b.color_id === v.color_id) - Number(a.color_id === v.color_id) || Number(b.is_cover) - Number(a.is_cover) || a.position - b.position,
      );
      const available = Math.max(0, v.stock_on_hand - v.stock_reserved);
      return [
        {
          itemId: item.id,
          variantId: v.id,
          productId: p.id,
          slug: p.slug,
          name: t?.name ?? p.slug,
          sku: v.sku,
          sizeLabel: v.sizes ? pickLocale(v.sizes.label, locale) || v.sizes.code : "",
          colorName: v.colors ? pickLocale(v.colors.name, locale) || v.colors.code : "",
          unitPrice: v.price ?? p.base_price,
          compareAtPrice: v.compare_at_price ?? p.compare_at_price,
          quantity: item.quantity,
          available,
          purchasable: v.is_active && p.status === "published" && available > 0,
          imagePath: imgs[0]?.path ?? null,
          imageAlt: pickLocale(imgs[0]?.alt, locale) || t?.name || p.slug,
        },
      ];
    });
  return { id: data.id, couponCode: data.coupon_code, lines, count: lines.reduce((n, l) => n + l.quantity, 0) };
}

export async function getCart(locale: Locale): Promise<CartView> {
  if (!isSupabaseConfigured()) return { id: null, couponCode: null, lines: [], count: 0 };
  const db = createServiceClient();
  const id = await findCartId(db);
  if (!id) return { id: null, couponCode: null, lines: [], count: 0 };
  return loadCart(db, id, locale);
}

export async function getCartCount(): Promise<number> {
  try {
    const db = createServiceClient();
    const id = await findCartId(db);
    if (!id) return 0;
    const { data } = await db.from("cart_items").select("quantity").eq("cart_id", id);
    return (data ?? []).reduce((n, r) => n + r.quantity, 0);
  } catch {
    return 0;
  }
}

async function variantAvailability(db: ServiceSupabase, variantId: string) {
  const { data } = await db
    .from("product_variants")
    .select("id, stock_on_hand, stock_reserved, is_active, products ( status )")
    .eq("id", variantId)
    .maybeSingle();
  if (!data || !data.is_active || data.products?.status !== "published") return null;
  return Math.max(0, data.stock_on_hand - data.stock_reserved);
}

export type CartMutationResult = { ok: true; quantity: number; adjusted: boolean } | { ok: false; reason: "unavailable" | "out_of_stock" | "not_found" };

export async function addCartItem(variantId: string, quantity: number): Promise<CartMutationResult> {
  const db = createServiceClient();
  const available = await variantAvailability(db, variantId);
  if (available === null) return { ok: false, reason: "unavailable" };
  if (available <= 0) return { ok: false, reason: "out_of_stock" };
  const cartId = await getOrCreateCartId(db);
  const { data: existing } = await db.from("cart_items").select("id, quantity").eq("cart_id", cartId).eq("variant_id", variantId).maybeSingle();
  const wanted = (existing?.quantity ?? 0) + quantity;
  const finalQty = Math.min(wanted, available, MAX_LINE_QTY);
  if (existing) {
    await db.from("cart_items").update({ quantity: finalQty }).eq("id", existing.id).eq("cart_id", cartId);
  } else {
    await db.from("cart_items").insert({ cart_id: cartId, variant_id: variantId, quantity: finalQty });
  }
  await db.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
  return { ok: true, quantity: finalQty, adjusted: finalQty !== wanted };
}

export async function setCartItemQuantity(itemId: string, quantity: number): Promise<CartMutationResult> {
  const db = createServiceClient();
  const cartId = await findCartId(db);
  if (!cartId) return { ok: false, reason: "not_found" };
  const { data: item } = await db.from("cart_items").select("id, variant_id").eq("id", itemId).eq("cart_id", cartId).maybeSingle();
  if (!item) return { ok: false, reason: "not_found" };
  if (quantity <= 0) {
    await db.from("cart_items").delete().eq("id", itemId).eq("cart_id", cartId);
    return { ok: true, quantity: 0, adjusted: false };
  }
  const available = (await variantAvailability(db, item.variant_id)) ?? 0;
  const finalQty = Math.max(1, Math.min(quantity, available || 1, MAX_LINE_QTY));
  await db.from("cart_items").update({ quantity: finalQty }).eq("id", itemId).eq("cart_id", cartId);
  return { ok: true, quantity: finalQty, adjusted: finalQty !== quantity };
}

export async function removeCartItem(itemId: string): Promise<void> {
  const db = createServiceClient();
  const cartId = await findCartId(db);
  if (!cartId) return;
  await db.from("cart_items").delete().eq("id", itemId).eq("cart_id", cartId);
}

export async function setCartCoupon(code: string | null): Promise<void> {
  const db = createServiceClient();
  const cartId = code ? await getOrCreateCartId(db) : await findCartId(db);
  if (!cartId) return;
  await db.from("carts").update({ coupon_code: code }).eq("id", cartId);
}

/** Loads a coupon and checks the time window / activity / usage (preview only — the DB re-checks atomically). */
export async function findUsableCoupon(code: string, subtotal: number, email?: string | null): Promise<CouponRule | null> {
  const db = createServiceClient();
  const { data: c } = await db.from("coupons").select("*").eq("code", code.trim().toUpperCase()).maybeSingle();
  if (!c || !c.is_active) return null;
  const now = Date.now();
  if (c.starts_at && Date.parse(c.starts_at) > now) return null;
  if (c.ends_at && Date.parse(c.ends_at) <= now) return null;
  if (subtotal < c.min_subtotal) return null;
  if (c.usage_limit !== null) {
    const { count } = await db
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .in("status", ["reserved", "applied"]);
    if ((count ?? 0) >= c.usage_limit) return null;
  }
  if (c.per_customer_limit !== null && email) {
    const { count } = await db
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .in("status", ["reserved", "applied"])
      .ilike("email", email);
    if ((count ?? 0) >= c.per_customer_limit) return null;
  }
  return { code: c.code, type: c.type, value: c.value, min_subtotal: c.min_subtotal, max_discount: c.max_discount };
}

export type CartSummary = CartView & { totals: Totals; coupon: CouponRule | null; couponRejected: boolean };

/** Cart + server-computed totals (shipping optional — shown at checkout). */
export async function getCartSummary(
  locale: Locale,
  opts: { shipping?: { price: number; free_over: number | null } | null; vatRateBps?: number | null; email?: string | null } = {},
): Promise<CartSummary> {
  const cart = await getCart(locale);
  const lines = cart.lines.filter((l) => l.purchasable).map((l) => ({ unitPrice: l.unitPrice, quantity: Math.min(l.quantity, l.available) }));
  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  const coupon = cart.couponCode ? await findUsableCoupon(cart.couponCode, subtotal, opts.email) : null;
  const totals = computeTotals({ lines, coupon, shipping: opts.shipping ?? null, vatRateBps: opts.vatRateBps });
  return { ...cart, totals, coupon, couponRejected: Boolean(cart.couponCode && !coupon) };
}

/** Call right after a successful sign-in (server action). */
export async function mergeGuestCartIntoUser(userId: string): Promise<boolean> {
  const db = createServiceClient();
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return false;
  const hash = sha256Hex(token);
  const { data: guest } = await db.from("carts").select("id, coupon_code, cart_items ( variant_id, quantity )").eq("token_hash", hash).is("user_id", null).maybeSingle();
  store.delete(CART_COOKIE);
  if (!guest || guest.cart_items.length === 0) {
    if (guest) await db.from("carts").delete().eq("id", guest.id);
    return false;
  }
  const { data: userCart } = await db.from("carts").select("id, cart_items ( id, variant_id, quantity )").eq("user_id", userId).maybeSingle();
  if (!userCart) {
    await db.from("carts").update({ user_id: userId, token_hash: null }).eq("id", guest.id);
    return true;
  }
  for (const gi of guest.cart_items) {
    const available = (await variantAvailability(db, gi.variant_id)) ?? 0;
    if (available <= 0) continue;
    const existing = userCart.cart_items.find((x) => x.variant_id === gi.variant_id);
    const qty = Math.min((existing?.quantity ?? 0) + gi.quantity, available, MAX_LINE_QTY);
    if (existing) await db.from("cart_items").update({ quantity: qty }).eq("id", existing.id);
    else await db.from("cart_items").insert({ cart_id: userCart.id, variant_id: gi.variant_id, quantity: qty });
  }
  if (guest.coupon_code) await db.from("carts").update({ coupon_code: guest.coupon_code }).eq("id", userCart.id);
  await db.from("carts").delete().eq("id", guest.id);
  return true;
}
