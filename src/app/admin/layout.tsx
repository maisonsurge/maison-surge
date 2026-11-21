import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireStaff } from "@/server/auth";
import { AdminShell } from "@/features/admin/ui/shell";
import { navForRoles, roleLabel } from "@/features/admin/nav";
import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = {
  title: { default: "Yönetim | MAISON SURGE", template: "%s | Yönetim | MAISON SURGE" },
  robots: { index: false, follow: false },
};

// Admin data is per-user and always fresh.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side gate: signed-out → login, signed-in without a staff role → 404.
  const { user, roles } = await requireStaff();
  return (
    <AdminShell
      items={navForRoles(roles)}
      userEmail={user.email}
      roleLabel={roleLabel(roles)}
      signOut={
        <form action={signOutAction}>
          <button type="submit" className="underline-offset-4 hover:text-paper hover:underline">
            Çıkış yap
          </button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
