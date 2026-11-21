"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Sidebar on desktop; full-screen sheet on mobile. Same single form, no duplicate ids. */
export function FilterPanel({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("input, select, button, a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 border border-line px-4 text-xs font-medium tracking-wide uppercase lg:hidden"
        aria-expanded={open}
        aria-controls="catalog-filters"
        data-testid="open-filters"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {t.catalog.filters}
        {activeCount > 0 ? <span className="rounded-full bg-ink px-1.5 text-[0.65rem] text-paper">{activeCount}</span> : null}
      </button>
      <div
        id="catalog-filters"
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={t.catalog.filters}
        className={cn(open ? "fixed inset-0 z-50 overflow-y-auto bg-paper p-5" : "hidden", "lg:static lg:block lg:overflow-visible lg:p-0")}
      >
        <div className="mb-6 flex items-center justify-between lg:hidden">
          <p className="eyebrow">{t.catalog.filters}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close} className="-m-2 p-2">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function SortSelect({ value }: { value: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const options: [string, string][] = [
    ["newest", t.catalog.sortNewest],
    ["featured", t.catalog.sortFeatured],
    ["price_asc", t.catalog.sortPriceAsc],
    ["price_desc", t.catalog.sortPriceDesc],
    ["name", t.catalog.sortName],
  ];
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="font-medium tracking-wide uppercase">{t.catalog.sort}</span>
      <select
        value={value}
        data-testid="sort-select"
        onChange={(e) => {
          const p = new URLSearchParams(search.toString());
          p.set("sort", e.target.value);
          p.delete("page");
          router.push(`${pathname}?${p.toString()}`);
        }}
        className="h-10 border border-line bg-paper px-2 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
