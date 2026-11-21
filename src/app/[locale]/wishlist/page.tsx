import type { Metadata } from "next";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { requireUser } from "@/server/auth";
import { getWishlistProductIds } from "@/server/wishlist";
import { searchProducts } from "@/server/catalog";
import { ProductGrid } from "@/components/product/product-grid";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import type { LocalePageProps } from "@/features/account/page-props";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.account.wishlist, robots: { index: false, follow: false } };
}

export default async function WishlistPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  await requireUser(locale, localePath(locale, "/wishlist"));
  const ids = [...(await getWishlistProductIds())];
  // Only published products are returned (unpublished favourites are hidden).
  const { items } = ids.length > 0 ? await searchProducts(locale, { ids, pageSize: 100 }) : { items: [] };

  return (
    <div className="container-ms py-10 md:py-14">
      <p className="eyebrow mb-2 text-olive">MAISON SURGE</p>
      <h1 className="mb-8 text-3xl md:text-4xl">{t.account.wishlist}</h1>
      {items.length === 0 ? (
        <EmptyState
          title={t.account.emptyWishlist}
          action={
            <ButtonLink href={localePath(locale, "/shop")} variant="outline">
              {t.cart.emptyCta}
            </ButtonLink>
          }
        />
      ) : (
        <ProductGrid items={items} locale={locale} wishlistIds={ids} />
      )}
    </div>
  );
}
