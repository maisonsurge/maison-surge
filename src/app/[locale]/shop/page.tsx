import type { Metadata } from "next";
import { CatalogView } from "@/features/catalog/catalog-view";
import { hasActiveFilters } from "@/features/catalog/query";
import { pageContext } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/shop">): Promise<Metadata> {
  const { locale, t } = await pageContext(params);
  const sp = await searchParams;
  // Filtered/search result pages are not indexed (canonical points to /shop).
  return buildMetadata({ locale, path: "/shop", title: t.catalog.title, description: t.meta.description, noindex: hasActiveFilters(sp) });
}

export default async function ShopPage({ params, searchParams }: PageProps<"/[locale]/shop">) {
  const { locale, t } = await pageContext(params);
  return <CatalogView locale={locale} searchParams={await searchParams} basePath="/shop" title={t.catalog.title} />;
}
