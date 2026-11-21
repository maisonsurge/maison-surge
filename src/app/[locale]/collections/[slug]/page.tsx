import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/features/catalog/catalog-view";
import { hasActiveFilters } from "@/features/catalog/query";
import { getCollectionBySlug } from "@/server/catalog";
import { pageContext } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/collections/[slug]">): Promise<Metadata> {
  const { locale } = await pageContext(params);
  const { slug } = await params;
  const col = await getCollectionBySlug(slug, locale);
  if (!col) return {};
  return buildMetadata({ locale, path: `/collections/${col.slug}`, title: col.nameText, description: col.descriptionText || undefined, noindex: hasActiveFilters(await searchParams) });
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/[locale]/collections/[slug]">) {
  const { locale } = await pageContext(params);
  const { slug } = await params;
  const col = await getCollectionBySlug(slug, locale);
  if (!col) notFound();
  return (
    <CatalogView
      locale={locale}
      searchParams={await searchParams}
      basePath={`/collections/${col.slug}`}
      title={col.nameText}
      description={col.descriptionText}
      collection={col.slug}
    />
  );
}
