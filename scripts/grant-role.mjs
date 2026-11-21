// Secure admin bootstrap (D-012).
// Usage:  npm run admin:grant -- someone@example.com admin
//         npm run admin:grant -- someone@example.com staff
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// (or the environment). The user must have signed up and verified their email first.
// The key is read locally and is never printed.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");

const [email, role = "admin"] = process.argv.slice(2);
if (!email || !["admin", "staff"].includes(role)) {
  console.error("Usage: npm run admin:grant -- <email> [admin|staff]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.rpc("grant_role_by_email", { p_email: email, p_role: role });
if (error) {
  console.error(`Failed: ${error.message === "user_not_found" ? "no auth user with that email (sign up first)" : error.message}`);
  process.exit(1);
}
console.log(`Granted role "${role}" to ${email} (user id ${data}).`);
