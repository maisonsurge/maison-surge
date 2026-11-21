import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "iyzico"]).default("mock"),
  MOCK_PAYMENT_WEBHOOK_SECRET: z.string().min(16).optional(),
  ALLOW_MOCK_PAYMENTS_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().url().default("https://sandbox-api.iyzipay.com"),
  CRON_SECRET: z.string().min(16).optional(),
  IP_HASH_SALT: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

function emptyToUndefined(env: NodeJS.ProcessEnv) {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) {
    const v = env[key];
    out[key] = v === undefined || v.trim() === "" ? undefined : v;
  }
  return out;
}

const parsed = schema.safeParse(emptyToUndefined(process.env));
if (!parsed.success) {
  // Never print values — only which keys are invalid.
  console.error("Invalid server environment keys:", parsed.error.issues.map((i) => i.path.join(".")).join(", "));
}

export const serverEnv = parsed.success ? parsed.data : schema.parse({});

/** True on the Vercel production deployment. */
export const isProductionDeployment = process.env.VERCEL_ENV === "production";
