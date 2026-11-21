// Boots an in-memory Postgres (PGlite), applies the Supabase stub, every
// migration in order and (optionally) the seed. Shared by tests and scripts.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function migrationFiles() {
  const dir = join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, sql: readFileSync(join(dir, f), "utf8") }));
}

export async function createDatabase({ seed = true } = {}) {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, "scripts", "lib", "supabase-stub.sql"), "utf8"));
  for (const m of migrationFiles()) {
    try {
      await db.exec(m.sql);
    } catch (err) {
      throw new Error(`Migration ${m.name} failed: ${err.message}`, { cause: err });
    }
  }
  if (seed) {
    try {
      await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
    } catch (err) {
      throw new Error(`seed.sql failed: ${err.message}`, { cause: err });
    }
  }
  return db;
}
