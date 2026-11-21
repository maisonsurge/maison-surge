import type { ProductCardData } from "@/server/catalog";
import type { Locale } from "@/i18n/config";
import { ProductCard } from "./product-card";

export function ProductGrid({
  items,
  locale,
  wishlistIds = [],
  priorityCount = 0,
}: {
  items: ProductCardData[];
  locale: Locale;
  wishlistIds?: string[] | Set<string>;
  priorityCount?: number;
}) {
  const wish = wishlistIds instanceof Set ? wishlistIds : new Set(wishlistIds);
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
      {items.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} locale={locale} inWishlist={wish.has(p.id)} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
