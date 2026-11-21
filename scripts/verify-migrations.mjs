// npm run db:verify — applies all migrations + seed twice-safe check on PGlite.
import { createDatabase } from "./lib/pglite-db.mjs";
import { readFileSync } from "node:fs";

const db = await createDatabase({ seed: true });
// seed must be idempotent
await db.exec(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
const { rows } = await db.query(
  "select (select count(*) from public.products) as products, (select count(*) from public.product_variants) as variants, (select count(*) from public.content_pages) as pages"
);
console.log("Migrations + seed applied OK:", rows[0]);
await db.close();
