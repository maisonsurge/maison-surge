import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/server/supabase/server";
import { applyPendingSignupConsent } from "@/server/account";
import { mergeGuestCartIntoUser } from "@/server/cart";
import { isSafeRelativePath } from "@/lib/utils";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * E-mail link handler (sign-up verification, password recovery, e-mail change).
 * Configure the Supabase e-mail templates to link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=…
 * (see docs/DEPLOYMENT.md).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  const fallback = type === "recovery" ? "/tr/auth/reset-password" : "/tr/account";
  const next = isSafeRelativePath(nextParam) ? nextParam : fallback;

  // Supabase's default e-mail template (PKCE) links back with ?code=…
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await applyPendingSignupConsent();
        await mergeGuestCartIntoUser(data.user.id);
      } catch (err) {
        console.error("[auth/confirm] post-verify step failed", err instanceof Error ? err.message : "unknown");
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      try {
        await applyPendingSignupConsent();
        await mergeGuestCartIntoUser(data.user.id);
      } catch (err) {
        console.error("[auth/confirm] post-verify step failed", err instanceof Error ? err.message : "unknown");
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/tr/auth/login?error=link", request.url));
}
