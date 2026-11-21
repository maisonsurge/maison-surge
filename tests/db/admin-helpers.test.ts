import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { as, createUser, freshDb, grantRole, type Db } from "./helpers";

let db: Db;
let admin: string;
let staff: string;
let customer: string;

beforeAll(async () => {
  db = await freshDb(true);
  admin = await createUser(db, `admin-${randomUUID()}@example.com`);
  staff = await createUser(db, `staff-${randomUUID()}@example.com`);
  customer = await createUser(db, `cust-${randomUUID()}@example.com`);
  await grantRole(db, admin, "admin");
  await grantRole(db, staff, "staff");
});
afterAll(async () => db.close());

describe("admin_user_emails (migration 0800)", () => {
  it("returns emails to admins only", async () => {
    const rows = await as(db, { role: "authenticated", userId: admin }, async (tx) =>
      (await tx.query<{ id: string; email: string }>(`select * from public.admin_user_emails($1::uuid[])`, [[customer]])).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toMatch(/^cust-/);
    await expect(
      as(db, { role: "authenticated", userId: staff }, (tx) => tx.query(`select * from public.admin_user_emails($1::uuid[])`, [[customer]])),
    ).rejects.toThrow(/forbidden/);
    await expect(
      as(db, { role: "authenticated", userId: customer }, (tx) => tx.query(`select * from public.admin_user_emails($1::uuid[])`, [[admin]])),
    ).rejects.toThrow(/forbidden/);
    await expect(as(db, { role: "anon" }, (tx) => tx.query(`select * from public.admin_user_emails($1::uuid[])`, [[admin]]))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("admin_low_stock_variants (migration 0800)", () => {
  it("lists variants at/below threshold for staff, denies customers", async () => {
    const rows = await as(db, { role: "authenticated", userId: staff }, async (tx) =>
      (await tx.query<{ available: number; low_stock_threshold: number }>(`select * from public.admin_low_stock_variants(500)`)).rows,
    );
    expect(rows.length).toBeGreaterThan(0); // seed contains sold-out variants
    expect(rows.every((r) => r.available <= r.low_stock_threshold)).toBe(true);
    await expect(
      as(db, { role: "authenticated", userId: customer }, (tx) => tx.query(`select * from public.admin_low_stock_variants(10)`)),
    ).rejects.toThrow(/forbidden/);
  });
});
