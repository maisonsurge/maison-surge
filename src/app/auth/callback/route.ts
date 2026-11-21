import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/server/supabase/server";
import { mergeGuestCartIntoUser } from "@/server/cart";
import { isSafeRelativePath } from "@/lib/utils";

/**
 * PKCE code exchange (OAuth providers or PKCE e-mail links). OAuth is optional
 * and not enabled by default — see docs/DEPLOYMENT.md.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next");
  const next = isSafeRelativePath(nextParam) ? nextParam : "/tr/account";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await mergeGuestCartIntoUser(data.user.id);
      } catch (err) {
        console.error("[auth/callback] cart merge failed", err instanceof Error ? err.message : "unknown");
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL("/tr/auth/login?error=link", request.url));
}
