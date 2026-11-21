import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "@/i18n/config";

/**
 * Proxy (Next.js 16 replacement for middleware):
 * 1. Locale routing: storefront paths without /tr or /en are redirected.
 * 2. Supabase session refresh (rotates auth cookies).
 * 3. UX-only redirect for signed-out visitors on /admin and /account.
 *
 * SECURITY: this is NOT an authorization layer. Every admin page, server
 * action and route handler re-checks the user and role server-side, and the
 * database enforces RLS/permissions.
 */
const PUBLIC_FILE = /\.[a-z0-9]+$/i;
const NON_LOCALE_PREFIXES = ["/admin", "/api", "/auth/callback", "/auth/confirm", "/_next", "/demo", "/brand"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";

  const needsLocale =
    !PUBLIC_FILE.test(pathname) && !NON_LOCALE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !isLocale(first);

  if (needsLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const locale = isLocale(first) ? first : defaultLocale;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ms-locale", locale);
  requestHeaders.set("x-ms-pathname", pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Refreshes the session if expired. Do not run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAccount = isLocale(first) && (pathname.startsWith(`/${first}/account`) || pathname.startsWith(`/${first}/wishlist`));
  if (!signedIn && (isAdmin || isAccount)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${isAdmin ? defaultLocale : locale}/auth/login`;
    redirectUrl.search = `?next=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(redirectUrl);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|api/webhooks).*)"],
};
