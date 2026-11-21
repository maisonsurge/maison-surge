import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductExperience } from "@/features/product/product-experience";
import { ProductGrid } from "@/components/product/product-grid";
import { Alert, Badge } from "@/components/ui/feedback";
import { Markdown } from "@/components/ui/markdown";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog";
import { getWishlistProductIds } from "@/server/wishlist";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n/config";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { toDecimalString } from "@/lib/money";
import { absoluteUrl, buildMetadata, jsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/product/[slug]">): Promise<Metadata> {
  const { locale } = await pageContext(params);
  const { slug } = await params;
  const p = await getProductBySlug(slug, locale);
  if (!p) return {};
  const description = (p.seoDescription || p.description).slice(0, 160) || undefined;
  return buildMetadata({ locale, path: `/product/${p.slug}`, title: p.seoTitle || p.name, description, image: imageUrl(p.images[0]?.path), noindex: p.isDemo });
}

export default async function ProductPage({ params }: PageProps<"/[locale]/product/[slug]">) {
  const { locale, t } = await pageContext(params);
  const { slug } = await params;
  const product = await getProductBySlug(slug, locale);
  if (!product) notFound();
  const [related, wish] = await Promise.all([getRelatedProducts(locale, product), getWishlistProductIds()]);

  const images = product.images.flatMap((i) => {
    const src = imageUrl(i.path);
    return src ? [{ id: i.id, src, alt: i.alt, unoptimized: isUnoptimizable(src), colorId: i.colorId }] : [];
  });
  const prices = product.variants.map((v) => v.price);
  const url = absoluteUrl(`/${locale}/product/${product.slug}`);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    sku: product.variants[0]?.sku,
    image: images.map((i) => (i.src.startsWith("http") ? i.src : absoluteUrl(i.src))),
    brand: { "@type": "Brand", name: "MAISON SURGE" },
    category: product.category?.name,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "TRY",
      lowPrice: prices.length ? toDecimalString(Math.min(...prices)) : undefined,
      highPrice: prices.length ? toDecimalString(Math.max(...prices)) : undefined,
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.available > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "MAISON SURGE", item: absoluteUrl(`/${locale}`) },
      ...(product.category ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: absoluteUrl(`/${locale}/shop/${product.category.slug}`) }] : []),
      { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name, item: url },
    ],
  };

  const details = (
    <div className="divide-y divide-line border-y border-line">
      <details className="group py-4" open>
        <summary className="flex cursor-pointer list-none items-center justify-between eyebrow">
          {t.product.description}
          <span aria-hidden className="text-lg transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink/85">{product.description || t.product.notProvided}</div>
      </details>
      <details className="group py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between eyebrow">
          {t.product.materialCare}
          <span aria-hidden className="text-lg transition-transform group-open:rotate-45">+</span>
        </summary>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-medium">{t.product.material}</dt>
            <dd className="mt-1 whitespace-pre-line text-ink/85">{product.material || t.product.notProvided}</dd>
          </div>
          <div>
            <dt className="font-medium">{t.product.care}</dt>
            <dd className="mt-1 whitespace-pre-line text-ink/85">{product.care || t.product.notProvided}</dd>
          </div>
        </dl>
      </details>
      <details className="group py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between eyebrow">
          {t.product.deliveryReturns}
          <span aria-hidden className="text-lg transition-transform group-open:rotate-45">+</span>
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-ink/85">
          {t.product.deliveryReturnsBody}{" "}
          <Link className="underline underline-offset-4" href={localePath(locale, "/pages/teslimat-ve-iade")}>
            {t.footer.delivery}
          </Link>
        </p>
      </details>
    </div>
  );

  return (
    <div className="container-ms py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <nav aria-label="breadcrumb" className="mb-6 text-xs text-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href={localePath(locale, "/shop")} className="hover:underline">
              {t.nav.shop}
            </Link>
          </li>
          {product.category ? (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={localePath(locale, `/shop/${product.category.slug}`)} className="hover:underline">
                  {product.category.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden>/</li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <ProductExperience
        productId={product.id}
        name={product.name}
        images={images}
        variants={product.variants}
        sizes={product.sizes}
        colors={product.colors}
        inWishlist={wish.has(product.id)}
        sizeGuide={product.sizeGuide ? <Markdown className="">{product.sizeGuide}</Markdown> : null}
        header={
          <div>
            {product.isDemo ? (
              <div className="mb-4">
                <Badge tone="warning">{t.common.demoBadge}</Badge>
              </div>
            ) : null}
            <h1 className="font-display text-3xl md:text-4xl" data-testid="product-title">
              {product.name}
            </h1>
            {product.isDemo ? (
              <Alert tone="warning" className="mt-4">
                {t.product.demoNotice}
              </Alert>
            ) : null}
          </div>
        }
        details={details}
      />

      {related.length > 0 ? (
        <section className="mt-24" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-8 font-display text-3xl">
            {t.product.related}
          </h2>
          <ProductGrid items={related} locale={locale} wishlistIds={wish} />
        </section>
      ) : null}
    </div>
  );
}
