"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Drawer } from "@/components/ui/overlay";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./language-switcher";

type Item = { href: string; label: string };

export function MobileMenu({ items, extra }: { locale: Locale; items: Item[]; extra: Item[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center hover:bg-sand-100 lg:hidden"
        aria-label={t.common.menu}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-testid="mobile-menu-button"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={t.common.menu} side="left" closeLabel={t.common.close}>
        <nav aria-label={t.common.menu} className="flex h-full flex-col">
          <ul className="flex flex-col px-5 py-4">
            {items.map((item) => (
              <li key={item.href} className="border-b border-line/70">
                <Link href={item.href} onClick={() => setOpen(false)} className="block py-4 font-display text-xl">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-auto flex flex-col gap-1 bg-sand-50 px-5 py-5">
            {extra.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="block py-2 text-sm">
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <LanguageSwitcher />
            </li>
          </ul>
        </nav>
      </Drawer>
    </>
  );
}
