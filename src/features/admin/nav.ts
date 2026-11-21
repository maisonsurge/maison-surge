import { rolesHavePermission, type AppRole, type Permission } from "@/lib/auth/permissions";
import type { NavItem } from "./ui/shell";

const ALL: (NavItem & { permission: Permission })[] = [
  { href: "/admin", label: "Gösterge paneli", icon: "dashboard", group: "Genel", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Siparişler", icon: "orders", group: "Satış", permission: "orders.view" },
  { href: "/admin/customers", label: "Müşteriler", icon: "customers", group: "Satış", permission: "customers.view" },
  { href: "/admin/coupons", label: "Kuponlar", icon: "coupons", group: "Satış", permission: "coupons.manage" },
  { href: "/admin/products", label: "Ürünler", icon: "products", group: "Katalog", permission: "catalog.manage" },
  { href: "/admin/categories", label: "Kategoriler", icon: "categories", group: "Katalog", permission: "catalog.manage" },
  { href: "/admin/collections", label: "Koleksiyonlar", icon: "collections", group: "Katalog", permission: "catalog.manage" },
  { href: "/admin/attributes", label: "Beden & Renk", icon: "attributes", group: "Katalog", permission: "catalog.manage" },
  { href: "/admin/inventory", label: "Stok", icon: "inventory", group: "Katalog", permission: "inventory.manage" },
  { href: "/admin/homepage", label: "Ana sayfa", icon: "homepage", group: "İçerik", permission: "content.manage" },
  { href: "/admin/pages", label: "Sayfalar", icon: "pages", group: "İçerik", permission: "content.manage" },
  { href: "/admin/inbox", label: "İletişim mesajları", icon: "inbox", group: "İletişim", permission: "inbox.manage" },
  { href: "/admin/newsletter", label: "Bülten", icon: "newsletter", group: "İletişim", permission: "newsletter.view" },
  { href: "/admin/settings", label: "Ayarlar", icon: "settings", group: "Sistem", permission: "settings.manage" },
  { href: "/admin/audit", label: "Denetim kaydı", icon: "audit", group: "Sistem", permission: "audit.view" },
];

export function navForRoles(roles: readonly AppRole[]): NavItem[] {
  return ALL.filter((i) => rolesHavePermission(roles, i.permission)).map(({ permission: _p, ...rest }) => rest);
}

export function roleLabel(roles: readonly AppRole[]): string {
  if (roles.includes("admin")) return "Yönetici (admin)";
  if (roles.includes("staff")) return "Personel (staff)";
  return "—";
}
