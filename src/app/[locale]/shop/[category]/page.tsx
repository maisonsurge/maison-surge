import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/features/catalog/catalog-view";
import { hasActiveFilters } from "@/features/catalog/query";
import { getCategoryBySlug } from "@/server/catalog";
import { pageContext } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/shop/[category]">): Promise<Metadata> {
  const { locale } = await pageContext(params);
  const { category } = await params;
  const cat = await getCategoryBySlug(category, locale);
  if (!cat) return {};
  return buildMetadata({
    locale,
    path: `/shop/${cat.slug}`,
    title: cat.seoTitle || cat.nameText,
    description: cat.seoDescription || cat.descriptionText || undefined,
    noindex: hasActiveFilters(await searchParams),
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[locale]/shop/[category]">) {
  const { locale } = await pageContext(params);
  const { category } = await params;
  const cat = await getCategoryBySlug(category, locale);
  if (!cat) notFound();
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      basePath={`/shop/${cat.slug}`}
      title={cat.nameText}
      description={cat.descriptionText}
      category={cat.slug}
    />
  );
}
