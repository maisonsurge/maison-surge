import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/server/supabase/server";
import { rolesHavePermission, type AppRole, type Permission } from "@/lib/auth/permissions";
import { localePath, type Locale } from "@/i18n/config";

export type SessionUser = { id: string; email: string };

/**
 * Authoritative user lookup: getUser() validates the JWT with Supabase Auth
 * (unlike reading the cookie). Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

export const getUserRoles = cache(async (): Promise<AppRole[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role);
});

export async function hasPermission(permission: Permission): Promise<boolean> {
  return rolesHavePermission(await getUserRoles(), permission);
}

/** Storefront pages that need a signed-in customer. */
export async function requireUser(locale: Locale, nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`${localePath(locale, "/auth/login")}?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * Admin pages: must be signed in AND hold a staff role (and the permission,
 * if given). Non-staff users get a 404 so the admin surface is not revealed.
 * This is enforced server-side on every admin page/action; the proxy redirect
 * is only a UX convenience, and RLS/permission checks in SQL are the final gate.
 */
export async function requireStaff(permission?: Permission): Promise<{ user: SessionUser; roles: AppRole[] }> {
  const user = await getSessionUser();
  if (!user) redirect(`/tr/auth/login?next=${encodeURIComponent("/admin")}`);
  const roles = await getUserRoles();
  if (roles.length === 0) notFound();
  if (permission && !rolesHavePermission(roles, permission)) redirect("/admin?forbidden=1");
  return { user, roles };
}

export class AuthorizationError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<{ user: SessionUser; roles: AppRole[] }> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("unauthenticated");
  const roles = await getUserRoles();
  if (!rolesHavePermission(roles, permission)) throw new AuthorizationError();
  return { user, roles };
}
