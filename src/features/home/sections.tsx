import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/product-grid";
import { NewsletterForm } from "@/features/newsletter/newsletter-form";
import { getCategories, getCollections, searchProducts, type HomepageSection } from "@/server/catalog";
import { getWishlistProductIds } from "@/server/wishlist";
import { imageUrl, isUnoptimizable, SITE_BUCKET } from "@/lib/images";
import { isSafeRelativePath, pickLocale } from "@/lib/utils";
import { localePath, type Locale } from "@/i18n/config";

type Props = { section: HomepageSection; locale: Locale; first: boolean };

function sectionImage(path: string | null) {
  // Admin uploads go to the site-assets bucket; seeded demo art is a /demo path.
  return imageUrl(path, SITE_BUCKET);
}

function cta(section: HomepageSection, locale: Locale) {
  const label = pickLocale(section.cta_label, locale);
  const href = isSafeRelativePath(section.cta_href) ? localePath(locale, section.cta_href) : null;
  return label && href ? { label, href } : null;
}

export function HeroSection({ section, locale, first }: Props) {
  const img = sectionImage(section.image_path);
  const action = cta(section, locale);
  const title = pickLocale(section.title, locale);
  return (
    <section className="relative isolate flex min-h-[72svh] items-end overflow-hidden bg-forest text-paper md:min-h-[86svh]" aria-label={title}>
      {img ? (
        <Image src={img} alt={pickLocale(section.image_alt, locale)} fill priority={first} unoptimized={isUnoptimizable(img)} sizes="100vw" className="-z-10 object-cover" />
      ) : null}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="container-ms pb-16 md:pb-24">
        {pickLocale(section.subtitle, locale) ? <p className="eyebrow text-sand">{pickLocale(section.subtitle, locale)}</p> : null}
        {first ? (
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] md:text-6xl lg:text-7xl">{title}</h1>
        ) : (
          <h2 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] md:text-6xl">{title}</h2>
        )}
        {pickLocale(section.body, locale) ? <p className="mt-5 max-w-xl text-sm leading-relaxed text-paper/85 md:text-base">{pickLocale(section.body, locale)}</p> : null}
        {action ? (
          <ButtonLink href={action.href} variant="outline" className="mt-8 border-paper text-paper hover:bg-paper hover:text-ink">
            {action.label}
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}

export async function CategoryGridSection({ section, locale }: Props) {
  const all = await getCategories(locale);
  const ids = Array.isArray((section.config as { category_ids?: unknown })?.category_ids)
    ? ((section.config as { category_ids: string[] }).category_ids)
    : [];
  const cats = (ids.length ? ids.map((id) => all.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c)) : all.filter((c) => !c.parent_id)).slice(0, 6);
  if (cats.length === 0) return null;
  const title = pickLocale(section.title, locale);
  return (
    <section className="container-ms py-20" aria-labelledby={`s-${section.id}`}>
      <h2 id={`s-${section.id}`} className="font-display text-3xl md:text-4xl">
        {title}
      </h2>
      <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cats.map((c) => {
          const img = imageUrl(c.image_path, SITE_BUCKET);
          return (
            <li key={c.id}>
              <Link href={localePath(locale, `/shop/${c.slug}`)} className="group block" data-testid="category-card">
                <div className="relative aspect-[3/4] overflow-hidden bg-sand">
                  {img ? (
                    <Image src={img} alt="" fill unoptimized={isUnoptimizable(img)} sizes="(min-width:1024px) 20vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  ) : null}
                </div>
                <p className="mt-3 text-[0.72rem] font-semibold tracking-[0.18em] uppercase group-hover:underline group-hover:underline-offset-4">{c.name}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export async function ProductRailSection({ section, locale }: Props) {
  const cfg = (section.config ?? {}) as { source?: string; collection_id?: string; limit?: number };
  const limit = Math.min(Math.max(Number(cfg.limit) || 8, 4), 12);
  let collectionSlug: string | null = null;
  if (cfg.source === "collection" && cfg.collection_id) {
    const cols = await getCollections(locale);
    collectionSlug = cols.find((c) => c.id === cfg.collection_id)?.slug ?? null;
    if (!collectionSlug) return null;
  }
  const [res, wish] = await Promise.all([
    searchProducts(locale, {
      featured: cfg.source === "featured",
      collection: collectionSlug,
      sort: cfg.source === "featured" ? "featured" : "newest",
      pageSize: limit,
    }),
    getWishlistProductIds(),
  ]);
  if (res.items.length === 0) return null;
  const action = cta(section, locale);
  return (
    <section className="container-ms py-16" aria-labelledby={`s-${section.id}`}>
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 id={`s-${section.id}`} className="font-display text-3xl md:text-4xl">
          {pickLocale(section.title, locale)}
        </h2>
        {action ? (
          <Link href={action.href} className="shrink-0 text-xs font-medium tracking-[0.16em] uppercase underline underline-offset-4">
            {action.label}
          </Link>
        ) : null}
      </div>
      <ProductGrid items={res.items} locale={locale} wishlistIds={wish} />
    </section>
  );
}

export function EditorialSection({ section, locale }: Props) {
  const img = sectionImage(section.image_path);
  const action = cta(section, locale);
  return (
    <section className="bg-sand" aria-labelledby={`s-${section.id}`}>
      <div className="container-ms grid items-center gap-10 py-20 md:grid-cols-2 md:gap-16">
        <div className="relative aspect-[4/5] overflow-hidden bg-sand-300">
          {img ? <Image src={img} alt={pickLocale(section.image_alt, locale)} fill unoptimized={isUnoptimizable(img)} sizes="(min-width:768px) 50vw, 100vw" className="object-cover" /> : null}
        </div>
        <div className="max-w-lg">
          {pickLocale(section.subtitle, locale) ? <p className="eyebrow text-olive">{pickLocale(section.subtitle, locale)}</p> : null}
          <h2 id={`s-${section.id}`} className="mt-4 font-display text-4xl italic md:text-5xl">
            {pickLocale(section.title, locale)}
          </h2>
          <p className="mt-6 leading-relaxed whitespace-pre-line text-ink/80">{pickLocale(section.body, locale)}</p>
          {action ? (
            <ButtonLink href={action.href} variant="outline" className="mt-8">
              {action.label}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function NewsletterSection({ section, locale }: Props) {
  return (
    <section className="bg-olive text-paper" aria-labelledby={`s-${section.id}`}>
      <div className="container-ms flex flex-col items-center py-20 text-center">
        <h2 id={`s-${section.id}`} className="font-display text-3xl md:text-4xl">
          {pickLocale(section.title, locale)}
        </h2>
        {pickLocale(section.body, locale) ? <p className="mt-4 max-w-md text-sm text-paper/85">{pickLocale(section.body, locale)}</p> : null}
        <div className="mt-8 w-full max-w-md text-left">
          <NewsletterForm source="home" variant="dark" />
        </div>
      </div>
    </section>
  );
}

export function HomeSection(props: Props) {
  switch (props.section.type) {
    case "hero":
      return <HeroSection {...props} />;
    case "category_grid":
      return <CategoryGridSection {...props} />;
    case "product_rail":
      return <ProductRailSection {...props} />;
    case "editorial":
      return <EditorialSection {...props} />;
    case "newsletter":
      return <NewsletterSection {...props} />;
    default:
      return null;
  }
}
