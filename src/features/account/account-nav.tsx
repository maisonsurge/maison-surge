"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/features/auth/actions";

export function AccountNav() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: localePath(locale, "/account"), label: t.account.overview, exact: true },
    { href: localePath(locale, "/account/orders"), label: t.account.orders },
    { href: localePath(locale, "/account/addresses"), label: t.account.addresses },
    { href: localePath(locale, "/wishlist"), label: t.account.wishlist },
  ];
  return (
    <nav aria-label={t.account.title} className="border-b border-line md:border-b-0">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 md:mx-0 md:flex-col md:gap-0 md:px-0 md:pb-0">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block px-3 py-2 text-sm transition-colors md:border-l-2 md:px-4 md:py-2.5",
                  active ? "font-medium text-ink md:border-burgundy" : "text-muted hover:text-ink md:border-transparent",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 md:mt-4">
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="block px-3 py-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline md:px-4">
              {t.common.signOut}
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
