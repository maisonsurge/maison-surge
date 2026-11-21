import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).host : null;
  } catch {
    return null;
  }
})();

const isDev = process.env.NODE_ENV !== "production";

/**
 * Safety guard: NEXT_PUBLIC_* values are inlined into the browser bundle.
 * Refuse to build/start if a Supabase SECRET or service_role key was put into
 * a public variable (it would bypass every RLS policy for every visitor).
 */
function assertNoSecretInPublicEnv() {
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    let isServiceJwt = false;
    const parts = value.split(".");
    if (parts.length === 3) {
      try {
        isServiceJwt = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")).role === "service_role";
      } catch {
        isServiceJwt = false;
      }
    }
    if (value.startsWith("sb_secret_") || isServiceJwt) {
      throw new Error(
        `${name} contains a Supabase SECRET/service_role key. Public variables are shipped to the browser. ` +
          `Use the publishable/anon key there and put the secret only in SUPABASE_SERVICE_ROLE_KEY. Rotate the exposed key.`,
      );
    }
  }
}
assertNoSecretInPublicEnv();

// Content-Security-Policy. 'unsafe-inline' for scripts is required by Next.js
// without nonces (inline bootstrap); no third-party script origins are allowed.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Payment providers' hosted pages are reached by top-level navigation/redirect.
  "form-action 'self' https://sandbox-api.iyzipay.com https://api.iyzipay.com",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 85],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
