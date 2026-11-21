"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";

/** Plain GET form → /{locale}/shop?q=… (works without JS via the shop page too). */
export function SearchButton() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center hover:bg-sand-100"
        aria-label={t.common.search}
        aria-haspopup="dialog"
        data-testid="search-button"
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.common.search} closeLabel={t.common.close}>
        <form action={localePath(locale, "/shop")} method="get" role="search" className="flex gap-2">
          <label htmlFor="site-search" className="sr-only">
            {t.common.search}
          </label>
          <Input id="site-search" name="q" type="search" placeholder={t.common.searchPlaceholder} autoFocus minLength={2} maxLength={80} required />
          <Button type="submit">{t.common.search}</Button>
        </form>
      </Dialog>
    </>
  );
}
