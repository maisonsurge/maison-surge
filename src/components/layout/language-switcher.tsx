"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, locales, switchLocalePath } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Wrapped in Suspense because useSearchParams opts the subtree into client rendering. */
export function LanguageSwitcher() {
  return (
    <Suspense fallback={null}>
      <LanguageSwitcherInner />
    </Suspense>
  );
}

function LanguageSwitcherInner() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  return (
    <div className="flex items-center gap-1 text-[0.7rem] font-semibold tracking-[0.14em] uppercase" role="group" aria-label={t.common.language}>
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 ? <span aria-hidden className="text-line">/</span> : null}
          <Link
            href={`${switchLocalePath(pathname, l)}${qs ? `?${qs}` : ""}`}
            hrefLang={l}
            lang={l}
            aria-current={l === locale ? "true" : undefined}
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            }}
            className={cn("px-1.5 py-2", l === locale ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink")}
          >
            {l}
          </Link>
        </span>
      ))}
    </div>
  );
}
