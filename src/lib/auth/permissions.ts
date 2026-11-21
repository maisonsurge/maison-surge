/**
 * Role → permission matrix. MUST mirror public.role_has_permission() in
 * supabase/migrations/20261121000100_foundation.sql — tests/db/permissions.test.ts
 * fails if they drift. The database is the enforcement point (RLS + checks in
 * security definer functions); this copy drives UI and server-side guards.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "catalog.manage",
  "inventory.manage",
  "orders.view",
  "orders.manage",
  "orders.refund",
  "customers.view",
  "coupons.manage",
  "content.manage",
  "settings.manage",
  "inbox.manage",
  "newsletter.view",
  "audit.view",
  "roles.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type AppRole = "admin" | "staff";

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  staff: ["dashboard.view", "catalog.manage", "inventory.manage", "orders.view", "orders.manage", "inbox.manage"],
};

export function roleHasPermission(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function rolesHavePermission(roles: readonly AppRole[], permission: Permission): boolean {
  return roles.some((r) => roleHasPermission(r, permission));
}
