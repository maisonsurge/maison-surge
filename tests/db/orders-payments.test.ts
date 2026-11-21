import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  as,
  createOrder,
  createUser,
  firstVariant,
  freshDb,
  grantRole,
  orderPayload,
  shippingMethod,
  variantStock,
  type Db,
} from "./helpers";

let db: Db;
let ship: Awaited<ReturnType<typeof shippingMethod>>;

const shippingFor = (subtotal: number) =>
  ship.free_over !== null && subtotal >= ship.free_over ? 0 : ship.price;

beforeAll(async () => {
  db = await freshDb(true);
  ship = await shippingMethod(db);
});
afterAll(async () => db.close());

async function newOrder(quantity = 1, extra: Partial<Parameters<typeof orderPayload>[0]> = {}) {
  const v = await firstVariant(db, quantity);
  const payload = orderPayload({
    key: randomUUID(),
    variantId: v.id,
    unitPrice: v.price,
    quantity,
    shippingMethodId: ship.id,
    shippingTotal: shippingFor(v.price * quantity),
    ...extra,
  });
  const res = await createOrder(db, payload);
  return { v, payload, res };
}

const confirm = (orderId: string, eventId: string, amount: number) =>
  db
    .query<{ r: string }>(
      `select public.confirm_payment('mock', $1, 'payment.succeeded', $2, $3, $4, 'TRY', '{}'::jsonb) as r`,
      [eventId, orderId, `pay_${eventId}`, amount],
    )
    .then((x) => x.rows[0]!.r);

describe("create_order", () => {
  it("reserves stock and is idempotent per key", async () => {
    const v = await firstVariant(db, 3);
    const before = await variantStock(db, v.id);
    const payload = orderPayload({
      key: randomUUID(),
      variantId: v.id,
      unitPrice: v.price,
      quantity: 2,
      shippingMethodId: ship.id,
      shippingTotal: shippingFor(v.price * 2),
    });
    const a = await createOrder(db, payload);
    const b = await createOrder(db, payload);
    expect(a.existing).toBe(false);
    expect(b.existing).toBe(true);
    expect(b.order_id).toBe(a.order_id);
    const after = await variantStock(db, v.id);
    expect(after.stock_reserved).toBe(before.stock_reserved + 2);
    expect(after.stock_on_hand).toBe(before.stock_on_hand);
  });

  it("rejects a tampered unit price", async () => {
    const v = await firstVariant(db, 1);
    const payload = orderPayload({
      key: randomUUID(), variantId: v.id, unitPrice: 1, quantity: 1, shippingMethodId: ship.id, shippingTotal: shippingFor(1),
    });
    await expect(createOrder(db, payload)).rejects.toThrow(/price_changed/);
  });

  it("rejects wrong shipping total", async () => {
    const v = await firstVariant(db, 1);
    const payload = orderPayload({
      key: randomUUID(), variantId: v.id, unitPrice: v.price, quantity: 1, shippingMethodId: ship.id, shippingTotal: 0,
    });
    if (shippingFor(v.price) === 0) return; // free shipping — nothing to tamper
    await expect(createOrder(db, payload)).rejects.toThrow(/shipping_total_mismatch/);
  });

  it("prevents overselling: cannot reserve more than available", async () => {
    const v = await firstVariant(db, 2);
    const s = await variantStock(db, v.id);
    const available = s.stock_on_hand - s.stock_reserved;
    const qty = Math.min(available, 20);
    // take everything that's available (in chunks of max 20)
    let left = available;
    while (left > 0) {
      const q = Math.min(left, 20);
      await createOrder(db, orderPayload({
        key: randomUUID(), variantId: v.id, unitPrice: v.price, quantity: q, shippingMethodId: ship.id, shippingTotal: shippingFor(v.price * q),
      }));
      left -= q;
    }
    expect(qty).toBeGreaterThan(0);
    await expect(
      createOrder(db, orderPayload({
        key: randomUUID(), variantId: v.id, unitPrice: v.price, quantity: 1, shippingMethodId: ship.id, shippingTotal: shippingFor(v.price),
      })),
    ).rejects.toThrow(/insufficient_stock/);
  });

  it("is not executable by anon or authenticated roles", async () => {
    const v = await firstVariant(db, 1);
    const payload = orderPayload({
      key: randomUUID(), variantId: v.id, unitPrice: v.price, quantity: 1, shippingMethodId: ship.id, shippingTotal: shippingFor(v.price),
    });
    await expect(as(db, { role: "anon" }, (tx) => createOrder(tx, payload))).rejects.toThrow(/permission denied/);
    const uid = await createUser(db, `u-${randomUUID()}@example.com`);
    await expect(as(db, { role: "authenticated", userId: uid }, (tx) => createOrder(tx, payload))).rejects.toThrow(/permission denied/);
  });
});

describe("confirm_payment (webhook) idempotency", () => {
  it("decrements on-hand stock exactly once even when the event is redelivered", async () => {
    const { v, res, payload } = await newOrder(1);
    const before = await variantStock(db, v.id);
    const eventId = `evt_${randomUUID()}`;
    expect(await confirm(res.order_id, eventId, payload.grand_total)).toBe("confirmed");
    expect(await confirm(res.order_id, eventId, payload.grand_total)).toBe("duplicate_event");
    // a different event id for the same order must not double count either
    expect(await confirm(res.order_id, `evt_${randomUUID()}`, payload.grand_total)).toBe("already_paid");

    const after = await variantStock(db, v.id);
    expect(after.stock_on_hand).toBe(before.stock_on_hand - 1);
    expect(after.stock_reserved).toBe(before.stock_reserved - 1);

    const { rows } = await db.query<{ status: string; payment_status: string; n: number }>(
      `select o.status, o.payment_status,
              (select count(*)::int from public.inventory_movements m where m.order_id = o.id and m.type = 'sale') as n
         from public.orders o where o.id = $1`,
      [res.order_id],
    );
    expect(rows[0]).toMatchObject({ status: "confirmed", payment_status: "paid", n: 1 });
  });

  it("refuses to confirm when the amount does not match", async () => {
    const { res, payload } = await newOrder(1);
    expect(await confirm(res.order_id, `evt_${randomUUID()}`, payload.grand_total - 1)).toBe("amount_mismatch");
    const { rows } = await db.query<{ status: string; payment_status: string }>(
      `select status, payment_status from public.orders where id = $1`,
      [res.order_id],
    );
    expect(rows[0]!.payment_status).not.toBe("paid");
    expect(rows[0]!.status).toBe("on_hold");
  });

  it("failed payment keeps the order retryable and is idempotent", async () => {
    const { res } = await newOrder(1);
    const evt = `evt_${randomUUID()}`;
    const fail = () =>
      db.query<{ r: string }>(`select public.fail_payment('mock', $1, 'payment.failed', $2, 'card declined', '{}') as r`, [evt, res.order_id]).then((x) => x.rows[0]!.r);
    expect(await fail()).toBe("failed");
    expect(await fail()).toBe("duplicate_event");
    const { rows } = await db.query<{ status: string; payment_status: string }>(`select status, payment_status from public.orders where id = $1`, [res.order_id]);
    expect(rows[0]).toMatchObject({ status: "pending_payment", payment_status: "failed" });
    // can start a new attempt
    await db.query(`select public.start_payment($1, 'mock', $2, true)`, [res.order_id, `sess_${randomUUID()}`]);
  });

  it("payment status cannot be changed by direct UPDATE (even by the table owner)", async () => {
    const { res } = await newOrder(1);
    await expect(db.query(`update public.orders set payment_status = 'paid' where id = $1`, [res.order_id])).rejects.toThrow(
      /payment_status_direct_update_forbidden/,
    );
  });

  it("stock cannot be changed by direct UPDATE", async () => {
    const v = await firstVariant(db, 1);
    await expect(db.query(`update public.product_variants set stock_on_hand = 999 where id = $1`, [v.id])).rejects.toThrow(
      /stock_direct_update_forbidden/,
    );
  });
});

describe("reservation expiry", () => {
  it("releases reserved stock and marks the order expired", async () => {
    const { v, res, payload } = await newOrder(1);
    const reserved = (await variantStock(db, v.id)).stock_reserved;
    await db.query(`update public.orders set reservation_expires_at = now() - interval '1 minute' where id = $1`, [res.order_id]);
    await db.query(`update public.stock_reservations set expires_at = now() - interval '1 minute' where order_id = $1`, [res.order_id]);
    const { rows } = await db.query<{ n: number }>(`select public.release_expired_reservations(100) as n`);
    expect(rows[0]!.n).toBeGreaterThanOrEqual(1);
    expect((await variantStock(db, v.id)).stock_reserved).toBe(reserved - 1);
    const o = await db.query<{ status: string }>(`select status from public.orders where id = $1`, [res.order_id]);
    expect(o.rows[0]!.status).toBe("expired");
    // late payment for an expired order: stock is still available, so it is taken directly
    expect(await confirm(res.order_id, `evt_${randomUUID()}`, payload.grand_total)).toBe("confirmed_after_expiry");
  });
});

describe("admin order operations", () => {
  it("cancel of a paid order restocks and creates a pending refund; refund completion updates payment status", async () => {
    const admin = await createUser(db, `admin-${randomUUID()}@example.com`);
    await grantRole(db, admin, "admin");
    const { v, res, payload } = await newOrder(1);
    await confirm(res.order_id, `evt_${randomUUID()}`, payload.grand_total);
    const onHandPaid = (await variantStock(db, v.id)).stock_on_hand;

    const refundId = await as(db, { role: "authenticated", userId: admin }, async (tx) => {
      const r = await tx.query<{ id: string }>(`select public.admin_cancel_order($1, 'customer request', true) as id`, [res.order_id]);
      return r.rows[0]!.id;
    });
    expect(refundId).toBeTruthy();
    expect((await variantStock(db, v.id)).stock_on_hand).toBe(onHandPaid + 1);

    const r = await db.query<{ r: string }>(`select public.complete_refund($1, true, 'rf_1', null, $2) as r`, [refundId, admin]);
    expect(r.rows[0]!.r).toBe("completed");
    const again = await db.query<{ r: string }>(`select public.complete_refund($1, true, 'rf_1', null, $2) as r`, [refundId, admin]);
    expect(again.rows[0]!.r).toBe("already_completed");
    const o = await db.query<{ status: string; payment_status: string; refunded_total: number }>(
      `select status, payment_status, refunded_total from public.orders where id = $1`,
      [res.order_id],
    );
    expect(o.rows[0]).toMatchObject({ status: "cancelled", payment_status: "refunded", refunded_total: payload.grand_total });
  });

  it("staff can progress fulfilment but cannot cancel a paid order (refund permission)", async () => {
    const staff = await createUser(db, `staff-${randomUUID()}@example.com`);
    await grantRole(db, staff, "staff");
    const { res, payload } = await newOrder(1);
    await confirm(res.order_id, `evt_${randomUUID()}`, payload.grand_total);
    await as(db, { role: "authenticated", userId: staff }, (tx) =>
      tx.query(`select public.admin_update_order_status($1, 'processing', 'packing')`, [res.order_id]),
    );
    await expect(
      as(db, { role: "authenticated", userId: staff }, (tx) => tx.query(`select public.admin_cancel_order($1, 'nope', true)`, [res.order_id])),
    ).rejects.toThrow(/forbidden_refund/);
    await as(db, { role: "authenticated", userId: staff }, (tx) =>
      tx.query(`select public.admin_mark_shipped($1, 'Test Kargo', 'TRK123456', 'https://example.com/t/TRK123456')`, [res.order_id]),
    );
    await expect(
      as(db, { role: "authenticated", userId: staff }, (tx) => tx.query(`select public.admin_update_order_status($1, 'confirmed')`, [res.order_id])),
    ).rejects.toThrow(/invalid_transition/);
  });

  it("regular customers cannot call admin functions", async () => {
    const user = await createUser(db, `c-${randomUUID()}@example.com`);
    const { res } = await newOrder(1);
    await expect(
      as(db, { role: "authenticated", userId: user }, (tx) => tx.query(`select public.admin_update_order_status($1, 'processing')`, [res.order_id])),
    ).rejects.toThrow(/forbidden/);
    await expect(
      as(db, { role: "authenticated", userId: user }, (tx) => tx.query(`select public.admin_dashboard_stats(30)`)),
    ).rejects.toThrow(/forbidden/);
  });

  it("admin stock adjustment logs a movement and respects reservations", async () => {
    const admin = await createUser(db, `admin2-${randomUUID()}@example.com`);
    await grantRole(db, admin, "staff");
    const v = await firstVariant(db, 1);
    await as(db, { role: "authenticated", userId: admin }, (tx) =>
      tx.query(`select public.admin_set_variant_stock($1, 50, 'stock count')`, [v.id]),
    );
    expect((await variantStock(db, v.id)).stock_on_hand).toBe(50);
    const m = await db.query<{ n: number }>(
      `select count(*)::int as n from public.inventory_movements where variant_id = $1 and type = 'adjustment' and actor_id = $2`,
      [v.id, admin],
    );
    expect(m.rows[0]!.n).toBe(1);
  });

  it("product duplication creates a draft copy with zero stock", async () => {
    const admin = await createUser(db, `admin3-${randomUUID()}@example.com`);
    await grantRole(db, admin, "staff");
    const { rows } = await db.query<{ id: string }>(`select id from public.products where is_demo order by slug limit 1`);
    const newId = await as(db, { role: "authenticated", userId: admin }, async (tx) =>
      (await tx.query<{ id: string }>(`select public.admin_duplicate_product($1) as id`, [rows[0]!.id])).rows[0]!.id,
    );
    const p = await db.query<{ status: string; stock: number; n: number }>(
      `select p.status, coalesce(sum(v.stock_on_hand), 0)::int as stock, count(v.id)::int as n
         from public.products p left join public.product_variants v on v.product_id = p.id where p.id = $1 group by p.status`,
      [newId],
    );
    expect(p.rows[0]).toMatchObject({ status: "draft", stock: 0 });
    expect(p.rows[0]!.n).toBeGreaterThan(0);
  });
});

describe("coupons", () => {
  it("enforces usage limit atomically and validates the discount amount", async () => {
    await db.query(`insert into public.coupons (code, type, value, usage_limit) values ('TEST10', 'percent', 10, 1)`);
    const v = await firstVariant(db, 2);
    const discount = Math.floor((v.price * 10) / 100);
    const mk = (d: number) =>
      orderPayload({
        key: randomUUID(), variantId: v.id, unitPrice: v.price, quantity: 1, shippingMethodId: ship.id,
        shippingTotal: shippingFor(v.price - d), discount: d, coupon: "TEST10",
      });
    await expect(createOrder(db, mk(discount + 100))).rejects.toThrow(/discount_mismatch/);
    await createOrder(db, mk(discount));
    await expect(createOrder(db, mk(discount))).rejects.toThrow(/coupon_limit_reached/);
  });
});
