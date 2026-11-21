import { Suspense } from "react";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-grid";
import { EmptyState } from "@/components/ui/feedback";
import { buttonClasses } from "@/components/ui/button";
import { getCategories, getColors, getSizes, searchProducts } from "@/server/catalog";
import { getWishlistProductIds } from "@/server/wishlist";
import { format, getDictionary } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { FilterPanel, SortSelect } from "./filter-panel";
import { hasActiveFilters, parseCatalogParams, withParams, type RawSearchParams } from "./query";

export async function CatalogView({
  locale,
  searchParams,
  basePath,
  title,
  description,
  category,
  collection,
}: {
  locale: Locale;
  searchParams: RawSearchParams;
  basePath: string; // e.g. "/shop" or "/shop/polo"
  title: string;
  description?: string;
  category?: string | null;
  collection?: string | null;
}) {
  const t = getDictionary(locale);
  const query = parseCatalogParams(searchParams);
  const [result, categories, sizes, colors, wish] = await Promise.all([
    searchProducts(locale, { ...query, category, collection }),
    getCategories(locale),
    getSizes(locale),
    getColors(locale),
    getWishlistProductIds(),
  ]);
  const href = (qs: string) => `${localePath(locale, basePath)}${qs}`;
  const active = hasActiveFilters(searchParams);
  const activeCount = query.sizes.length + query.colors.length + (query.minPrice !== null ? 1 : 0) + (query.maxPrice !== null ? 1 : 0) + (query.inStock ? 1 : 0);

  return (
    <div className="container-ms py-10 md:py-14">
      <header className="mb-8 md:mb-12">
        <nav aria-label="breadcrumb" className="mb-4 text-xs text-muted">
          <ol className="flex flex-wrap gap-2">
            <li>
              <Link href={localePath(locale)} className="hover:underline">
                MAISON SURGE
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
        <h1 className="font-display text-4xl md:text-5xl">{query.q ? format(t.catalog.searchFor, { q: query.q }) : title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm text-muted">{description}</p> : null}
      </header>

      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside aria-label={t.catalog.filters}>
          <FilterPanel activeCount={activeCount}>
            <form method="get" action={localePath(locale, basePath)} className="space-y-8" data-testid="filter-form">
              {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
              <input type="hidden" name="sort" value={query.sort} />
              <section>
                <h2 className="eyebrow mb-3">{t.catalog.category}</h2>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link href={localePath(locale, "/shop")} className={cn("hover:underline", !category && !collection && "font-semibold underline underline-offset-4")}>
                      {t.nav.allProducts}
                    </Link>
                  </li>
                  {categories.map((c) => (
                    <li key={c.id} className={c.parent_id ? "pl-3" : undefined}>
                      <Link href={localePath(locale, `/shop/${c.slug}`)} className={cn("hover:underline", category === c.slug && "font-semibold underline underline-offset-4")}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              <fieldset>
                <legend className="eyebrow mb-3">{t.catalog.size}</legend>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <label key={s.id} className="relative cursor-pointer">
                      <input type="checkbox" name="size" value={s.code} defaultChecked={query.sizes.includes(s.code)} className="peer sr-only" />
                      <span className="inline-flex h-9 min-w-11 items-center justify-center border border-line px-2 text-xs peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-burgundy">
                        {s.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="eyebrow mb-3">{t.catalog.color}</legend>
                <div className="space-y-2">
                  {colors.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-3 text-sm">
                      <input type="checkbox" name="color" value={c.code} defaultChecked={query.colors.includes(c.code)} className="h-4 w-4 accent-[var(--color-olive)]" />
                      <span aria-hidden className="h-4 w-4 rounded-full border border-line" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="eyebrow mb-3">{t.catalog.price}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    <span className="mb-1 block text-muted">{t.catalog.minPrice}</span>
                    <input type="number" name="min" min={0} step={1} inputMode="numeric" defaultValue={query.minPrice !== null ? query.minPrice / 100 : ""} className="h-10 w-full border border-line bg-paper px-2 text-sm" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-muted">{t.catalog.maxPrice}</span>
                    <input type="number" name="max" min={0} step={1} inputMode="numeric" defaultValue={query.maxPrice !== null ? query.maxPrice / 100 : ""} className="h-10 w-full border border-line bg-paper px-2 text-sm" />
                  </label>
                </div>
              </fieldset>
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input type="checkbox" name="stock" value="1" defaultChecked={query.inStock} className="h-4 w-4 accent-[var(--color-olive)]" />
                {t.catalog.inStock}
              </label>
              <div className="flex flex-col gap-2">
                <button type="submit" className={buttonClasses("primary", "md", "w-full")} data-testid="apply-filters">
                  {t.catalog.applyFilters}
                </button>
                {active ? (
                  <Link href={localePath(locale, basePath)} className={buttonClasses("ghost", "md", "w-full")}>
                    {t.catalog.clearFilters}
                  </Link>
                ) : null}
              </div>
            </form>
          </FilterPanel>
        </aside>

        <section aria-label={title}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" aria-live="polite" data-testid="result-count">
              {format(t.catalog.results, { count: result.total })}
            </p>
            <Suspense fallback={null}>
              <SortSelect value={query.sort} />
            </Suspense>
          </div>
          {result.items.length === 0 ? (
            <EmptyState
              title={t.catalog.noResults}
              action={
                active ? (
                  <Link href={localePath(locale, basePath)} className={buttonClasses("outline")}>
                    {t.catalog.clearFilters}
                  </Link>
                ) : null
              }
            />
          ) : (
            <ProductGrid items={result.items} locale={locale} wishlistIds={wish} priorityCount={4} />
          )}
          {result.pageCount > 1 ? (
            <nav aria-label={format(t.catalog.page, { page: result.page, total: result.pageCount })} className="mt-14 flex items-center justify-center gap-2" data-testid="pagination">
              {result.page > 1 ? (
                <Link rel="prev" href={href(withParams(searchParams, { page: String(result.page - 1) }))} className={buttonClasses("outline", "sm")}>
                  {t.catalog.prev}
                </Link>
              ) : null}
              <ul className="flex gap-1">
                {Array.from({ length: result.pageCount }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - result.page) <= 2 || p === 1 || p === result.pageCount)
                  .map((p) => (
                    <li key={p}>
                      <Link
                        href={href(withParams(searchParams, { page: p === 1 ? null : String(p) }))}
                        aria-current={p === result.page ? "page" : undefined}
                        className={cn("inline-flex h-9 min-w-9 items-center justify-center border text-xs", p === result.page ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}
                      >
                        {p}
                      </Link>
                    </li>
                  ))}
              </ul>
              {result.page < result.pageCount ? (
                <Link rel="next" href={href(withParams(searchParams, { page: String(result.page + 1) }))} className={buttonClasses("outline", "sm")}>
                  {t.catalog.next}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
