import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, type AppRole } from "@/lib/auth/permissions";
import { freshDb, type Db } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb(false);
});
afterAll(async () => db.close());

describe("permission matrix parity (SQL ⇄ TypeScript)", () => {
  for (const role of ["admin", "staff"] as AppRole[]) {
    it(`${role} matches`, async () => {
      for (const p of [...PERMISSIONS, "nonexistent.permission"]) {
        const { rows } = await db.query<{ ok: boolean }>(
          `select public.role_has_permission($1::public.app_role, $2) as ok`,
          [role, p],
        );
        expect(rows[0]!.ok, `${role} / ${p}`).toBe((ROLE_PERMISSIONS[role] as readonly string[]).includes(p));
      }
    });
  }
});
