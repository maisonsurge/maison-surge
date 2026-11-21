"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  FileText,
  Gauge,
  History,
  Inbox,
  LayoutTemplate,
  Mail,
  Menu,
  Package,
  Settings,
  Shapes,
  Tags,
  Ticket,
  Users,
  Warehouse,
  X,
  FolderTree,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: NavIcon; group: string };
export type NavIcon =
  | "dashboard"
  | "products"
  | "categories"
  | "collections"
  | "attributes"
  | "inventory"
  | "orders"
  | "customers"
  | "coupons"
  | "homepage"
  | "pages"
  | "settings"
  | "inbox"
  | "newsletter"
  | "audit";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: Gauge,
  products: Package,
  categories: FolderTree,
  collections: Boxes,
  attributes: Shapes,
  inventory: Warehouse,
  orders: ClipboardList,
  customers: Users,
  coupons: Ticket,
  homepage: LayoutTemplate,
  pages: FileText,
  settings: Settings,
  inbox: Inbox,
  newsletter: Mail,
  audit: History,
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Nav({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav aria-label="Yönetim menüsü" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g) => (
        <div key={g}>
          <p className="eyebrow mb-1.5 px-3 text-[0.62rem] text-sand-300">{g}</p>
          <ul className="flex flex-col gap-0.5">
            {items
              .filter((i) => i.group === g)
              .map((i) => {
                const Icon = ICONS[i.icon] ?? Tags;
                const active = isActive(pathname, i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                        active ? "bg-paper/10 text-paper" : "text-sand-100/80 hover:bg-paper/5 hover:text-paper",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  items,
  userEmail,
  roleLabel,
  signOut,
  children,
}: {
  items: NavItem[];
  userEmail: string;
  roleLabel: string;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = (
    <div className="flex h-16 items-center justify-between border-b border-paper/10 px-6">
      <Link href="/admin" className="font-display text-base tracking-[0.2em] text-paper">
        MAISON SURGE
      </Link>
      <span className="eyebrow text-[0.6rem] text-sand-300">Admin</span>
    </div>
  );

  const footer = (
    <div className="border-t border-paper/10 px-6 py-4 text-xs text-sand-100/80">
      <p className="truncate" title={userEmail}>
        {userEmail}
      </p>
      <p className="mt-0.5 text-sand-300">{roleLabel}</p>
      <div className="mt-3 flex items-center gap-4">
        <Link href="/tr" className="underline-offset-4 hover:text-paper hover:underline">
          Mağazayı gör
        </Link>
        {signOut}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-sand-50 text-ink lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
        İçeriğe geç
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-ink lg:flex">
        {brand}
        <div className="flex-1 overflow-y-auto">
          <Nav items={items} pathname={pathname} />
        </div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-paper lg:hidden">
        <Link href="/admin" className="font-display text-sm tracking-[0.2em]">
          MAISON SURGE
        </Link>
        <button type="button" aria-label="Menüyü aç" aria-expanded={open} aria-controls="admin-mobile-nav" onClick={() => setOpen(true)} className="-mr-2 p-2">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Yönetim menüsü">
          <button type="button" aria-label="Menüyü kapat" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div id="admin-mobile-nav" className="relative flex h-full w-[min(300px,85%)] animate-slide-in-left flex-col bg-ink">
            <div className="flex h-14 items-center justify-between border-b border-paper/10 px-4 text-paper">
              <span className="font-display text-sm tracking-[0.2em]">MAISON SURGE</span>
              <button type="button" aria-label="Menüyü kapat" onClick={() => setOpen(false)} className="-mr-2 p-2" autoFocus>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Nav items={items} pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      ) : null}

      <main id="admin-main" className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
