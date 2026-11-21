import type { PGlite } from "@electric-sql/pglite";
// @ts-expect-error — plain ESM helper shared with scripts/
import { createDatabase } from "../../scripts/lib/pglite-db.mjs";

export type Db = PGlite;

export async function freshDb(seed = true): Promise<Db> {
  return (await createDatabase({ seed })) as Db;
}

/** Runs `fn` inside a transaction as the given Supabase role / user (JWT sub). */
export async function as<T>(
  db: Db,
  who: { role: "anon" | "authenticated" | "service_role"; userId?: string },
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who.userId ?? ""]);
    await db.query(`select set_config('request.jwt.claim.role', $1, true)`, [who.role]);
    await db.exec(`set local role ${who.role}`);
    const result = await fn(db);
    await db.exec("commit");
    return result;
  } catch (err) {
    await db.exec("rollback");
    throw err;
  }
}

export async function createUser(db: Db, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, '{"full_name":"Test User"}') returning id`,
    [email],
  );
  return rows[0]!.id;
}

export async function grantRole(db: Db, userId: string, role: "admin" | "staff") {
  await db.query(`insert into public.user_roles (user_id, role) values ($1, $2)`, [userId, role]);
}

export async function firstVariant(db: Db, minStock = 2) {
  const { rows } = await db.query<{ id: string; price: number; stock_on_hand: number; stock_reserved: number }>(
    `select v.id, coalesce(v.price, p.base_price) as price, v.stock_on_hand, v.stock_reserved
       from public.product_variants v join public.products p on p.id = v.product_id
      where p.status = 'published' and v.is_active and v.stock_on_hand - v.stock_reserved >= $1
      order by v.sku limit 1`,
    [minStock],
  );
  return rows[0]!;
}

export async function shippingMethod(db: Db) {
  const { rows } = await db.query<{ id: string; price: number; free_over: number | null }>(
    `select id, price, free_over from public.shipping_methods where is_active order by position limit 1`,
  );
  return rows[0]!;
}

export function orderPayload(opts: {
  key: string;
  variantId: string;
  unitPrice: number;
  quantity: number;
  shippingMethodId: string;
  shippingTotal: number;
  discount?: number;
  coupon?: string | null;
  email?: string;
  userId?: string | null;
}) {
  const subtotal = opts.unitPrice * opts.quantity;
  const discount = opts.discount ?? 0;
  const address = { full_name: "Test Kişi", phone: "+905551112233", line1: "Test Mah. 1", district: "Kadıköy", city: "İstanbul", postal_code: "34710", country: "TR" };
  return {
    idempotency_key: opts.key,
    user_id: opts.userId ?? null,
    email: opts.email ?? "guest@example.com",
    phone: "+905551112233",
    locale: "tr",
    items: [{ variant_id: opts.variantId, quantity: opts.quantity, unit_price: opts.unitPrice }],
    subtotal,
    discount_total: discount,
    shipping_total: opts.shippingTotal,
    vat_total: 0,
    grand_total: subtotal - discount + opts.shippingTotal,
    coupon_code: opts.coupon ?? null,
    shipping_method_id: opts.shippingMethodId,
    shipping_address: address,
    billing_address: address,
    billing_info: { type: "individual" },
    payment_provider: "mock",
    terms_version: "test",
  };
}

export async function createOrder(db: Db, payload: ReturnType<typeof orderPayload>) {
  const { rows } = await db.query<{ r: { order_id: string; order_number: string; existing: boolean } }>(
    `select public.create_order($1::jsonb) as r`,
    [JSON.stringify(payload)],
  );
  return rows[0]!.r;
}

export async function variantStock(db: Db, id: string) {
  const { rows } = await db.query<{ stock_on_hand: number; stock_reserved: number }>(
    `select stock_on_hand, stock_reserved from public.product_variants where id = $1`,
    [id],
  );
  return rows[0]!;
}
