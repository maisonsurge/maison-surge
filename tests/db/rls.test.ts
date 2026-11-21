import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { as, createOrder, createUser, firstVariant, freshDb, grantRole, orderPayload, shippingMethod, type Db } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb(true);
});
afterAll(async () => db.close());

describe("deny-by-default privileges", () => {
  it("every public table has RLS enabled", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("Supabase's default ALL grants are revoked from anon (no write privileges on catalog)", async () => {
    const { rows } = await db.query<{ t: string }>(
      `select table_name as t from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`,
    );
    expect(rows).toEqual([]);
  });

  it("anon cannot read carts, orders, payments, coupons, audit logs or profiles", async () => {
    for (const t of ["carts", "cart_items", "orders", "payments", "payment_events", "coupons", "audit_logs", "profiles", "addresses", "rate_limits"]) {
      await expect(as(db, { role: "anon" }, (tx) => tx.query(`select * from public.${t} limit 1`)), t).rejects.toThrow(/permission denied/);
    }
  });
});

describe("catalog visibility", () => {
  it("anon sees only published products", async () => {
    await db.query(`update public.products set status = 'draft' where slug = 'demo-triko-polo'`);
    const visible = await as(db, { role: "anon" }, async (tx) =>
      (await tx.query<{ slug: string }>(`select slug from public.products`)).rows.map((r) => r.slug),
    );
    expect(visible).not.toContain("demo-triko-polo");
    expect(visible.length).toBeGreaterThan(0);
    const search = await as(db, { role: "anon" }, async (tx) =>
      (await tx.query<{ slug: string }>(`select slug from public.catalog_search('tr', null, null, null, null, null, null, null, false, 'newest', 100, 0)`)).rows.map((r) => r.slug),
    );
    expect(search).not.toContain("demo-triko-polo");
    await db.query(`update public.products set status = 'published' where slug = 'demo-triko-polo'`);
  });

  it("anon cannot insert products; staff can; customers cannot", async () => {
    const insert = (tx: Db) =>
      tx.query(`insert into public.products (slug, base_price) values ($1, 1000)`, [`rls-${randomUUID().slice(0, 8)}`]);
    await expect(as(db, { role: "anon" }, insert)).rejects.toThrow(/permission denied/);
    const customer = await createUser(db, `cust-${randomUUID()}@example.com`);
    await expect(as(db, { role: "authenticated", userId: customer }, insert)).rejects.toThrow(/row-level security/);
    const staff = await createUser(db, `staff-${randomUUID()}@example.com`);
    await grantRole(db, staff, "staff");
    await as(db, { role: "authenticated", userId: staff }, insert);
  });

  it("product cost is hidden from customers", async () => {
    const customer = await createUser(db, `cost-${randomUUID()}@example.com`);
    const rows = await as(db, { role: "authenticated", userId: customer }, async (tx) => (await tx.query(`select * from public.product_costs`)).rows);
    expect(rows).toEqual([]);
  });

  it("catalog_search filters by size, colour, price and stock", async () => {
    const all = await db.query<{ id: string }>(`select id from public.catalog_search('tr', 'tisort')`);
    expect(all.rows.length).toBe(2);
    const priced = await db.query<{ price: number }>(`select price from public.catalog_search('tr', null, null, null, null, null, 100000, 200000, false, 'price_asc')`);
    const prices = priced.rows.map((r) => r.price);
    expect(prices.every((p) => p >= 100000 && p <= 200000)).toBe(true);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    const q = await db.query<{ slug: string }>(`select slug from public.catalog_search('tr', null, null, 'hoodie')`);
    expect(q.rows.length).toBeGreaterThan(0);
    const injection = await db.query(`select slug from public.catalog_search('tr', null, null, '%'' or 1=1 --')`);
    expect(injection.rows.length).toBe(0);
  });
});

describe("customer data isolation", () => {
  it("users read only their own orders, addresses and wishlists", async () => {
    const alice = await createUser(db, `alice-${randomUUID()}@example.com`);
    const bob = await createUser(db, `bob-${randomUUID()}@example.com`);
    const ship = await shippingMethod(db);
    const v = await firstVariant(db, 1);
    const shipping = ship.free_over !== null && v.price >= ship.free_over ? 0 : ship.price;
    const order = await createOrder(db, orderPayload({
      key: randomUUID(), variantId: v.id, unitPrice: v.price, quantity: 1, shippingMethodId: ship.id, shippingTotal: shipping, userId: alice, email: "alice@example.com",
    }));

    const aliceOrders = await as(db, { role: "authenticated", userId: alice }, async (tx) => (await tx.query<{ id: string }>(`select id from public.orders`)).rows);
    const bobOrders = await as(db, { role: "authenticated", userId: bob }, async (tx) => (await tx.query<{ id: string }>(`select id from public.orders`)).rows);
    expect(aliceOrders.map((o) => o.id)).toContain(order.order_id);
    expect(bobOrders).toEqual([]);
    const bobItems = await as(db, { role: "authenticated", userId: bob }, async (tx) => (await tx.query(`select * from public.order_items`)).rows);
    expect(bobItems).toEqual([]);

    await as(db, { role: "authenticated", userId: alice }, (tx) =>
      tx.query(`insert into public.addresses (user_id, full_name, phone, line1, district, city) values ($1, 'Alice A', '+905551112233', 'Street 1', 'Kadıköy', 'İstanbul')`, [alice]),
    );
    // Bob cannot write an address for Alice
    await expect(
      as(db, { role: "authenticated", userId: bob }, (tx) =>
        tx.query(`insert into public.addresses (user_id, full_name, phone, line1, district, city) values ($1, 'X Y', '+905551112233', 'Street 1', 'Kadıköy', 'İstanbul')`, [alice]),
      ),
    ).rejects.toThrow(/row-level security/);
    const bobAddresses = await as(db, { role: "authenticated", userId: bob }, async (tx) => (await tx.query(`select * from public.addresses`)).rows);
    expect(bobAddresses).toEqual([]);

    const pid = (await db.query<{ id: string }>(`select id from public.products where status = 'published' limit 1`)).rows[0]!.id;
    await as(db, { role: "authenticated", userId: alice }, (tx) => tx.query(`insert into public.wishlists (user_id, product_id) values ($1, $2)`, [alice, pid]));
    const bobWish = await as(db, { role: "authenticated", userId: bob }, async (tx) => (await tx.query(`select * from public.wishlists`)).rows);
    expect(bobWish).toEqual([]);
  });

  it("a new auth user gets a profile but never a role", async () => {
    const uid = await createUser(db, `new-${randomUUID()}@example.com`);
    const p = await db.query(`select * from public.profiles where id = $1`, [uid]);
    const r = await db.query(`select * from public.user_roles where user_id = $1`, [uid]);
    expect(p.rows.length).toBe(1);
    expect(r.rows.length).toBe(0);
  });

  it("users cannot grant themselves roles", async () => {
    const uid = await createUser(db, `sneaky-${randomUUID()}@example.com`);
    await expect(
      as(db, { role: "authenticated", userId: uid }, (tx) => tx.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [uid])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, { role: "authenticated", userId: uid }, (tx) => tx.query(`select public.admin_set_role($1, 'admin', true)`, [uid])),
    ).rejects.toThrow(/forbidden/);
    await expect(
      as(db, { role: "authenticated", userId: uid }, (tx) => tx.query(`select public.grant_role_by_email('x@example.com', 'admin')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("admin actions are written to the audit log with the actor", async () => {
    const admin = await createUser(db, `aud-${randomUUID()}@example.com`);
    await grantRole(db, admin, "admin");
    await as(db, { role: "authenticated", userId: admin }, (tx) =>
      tx.query(`update public.site_settings set support_email = 'support@example.com' where id`),
    );
    const { rows } = await db.query<{ action: string; entity: string }>(
      `select action, entity from public.audit_logs where actor_id = $1`,
      [admin],
    );
    expect(rows).toContainEqual({ action: "update", entity: "site_settings" });
  });
});
