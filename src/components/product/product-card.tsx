import Image from "next/image";
import Link from "next/link";
import type { ProductCardData } from "@/server/catalog";
import { getDictionary } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { Price } from "@/components/ui/price";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({
  product,
  locale,
  inWishlist = false,
  priority = false,
}: {
  product: ProductCardData;
  locale: Locale;
  inWishlist?: boolean;
  priority?: boolean;
}) {
  const t = getDictionary(locale);
  const href = localePath(locale, `/product/${product.slug}`);
  const cover = imageUrl(product.coverPath);
  const hover = imageUrl(product.hoverPath);
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > product.price;

  return (
    <article className="group relative flex flex-col" data-testid="product-card">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand-100">
        <Link href={href} className="absolute inset-0 block" tabIndex={-1} aria-hidden>
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              priority={priority}
              unoptimized={isUnoptimizable(cover)}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover transition-opacity duration-500 group-hover:opacity-0 motion-reduce:transition-none"
            />
          ) : null}
          {hover ? (
            <Image
              src={hover}
              alt=""
              fill
              unoptimized={isUnoptimizable(hover)}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none"
            />
          ) : null}
        </Link>
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1">
          {!product.inStock ? <span className="bg-ink px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-paper">{t.catalog.soldOut}</span> : null}
          {onSale && product.inStock ? <span className="bg-burgundy px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-paper">{t.catalog.sale}</span> : null}
        </div>
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={product.id} initial={inWishlist} />
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        <h3 className="font-sans text-sm font-medium leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4 focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <Price amount={product.price} compareAt={product.compareAtPrice} locale={locale} className="text-sm" />
        {product.colorHexes.length > 0 ? (
          <ul className="mt-0.5 flex gap-1.5" aria-label={t.catalog.color}>
            {product.colorHexes.slice(0, 6).map((hex) => (
              <li key={hex} className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: hex }} />
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
