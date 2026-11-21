import type { Metadata } from "next";
import { HomeSection } from "@/features/home/sections";
import { getHomepageSections } from "@/server/catalog";
import { pageContext } from "@/i18n/server";
import { buildMetadata, jsonLd } from "@/lib/seo";
import { publicEnv } from "@/lib/env";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale, t } = await pageContext(params);
  return buildMetadata({ locale, path: "/", title: "MAISON SURGE", description: t.meta.description });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale, t } = await pageContext(params);
  const sections = await getHomepageSections();
  const hasHero = sections.some((s) => s.type === "hero");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "MAISON SURGE",
            url: `${publicEnv.siteUrl}/${locale}`,
            potentialAction: { "@type": "SearchAction", target: `${publicEnv.siteUrl}/${locale}/shop?q={search_term_string}`, "query-input": "required name=search_term_string" },
          }),
        }}
      />
      {!hasHero ? <h1 className="sr-only">MAISON SURGE</h1> : null}
      {sections.length === 0 ? (
        <div className="container-ms py-24">
          <EmptyState title="MAISON SURGE" body={t.meta.description} action={<ButtonLink href={localePath(locale, "/shop")}>{t.nav.allProducts}</ButtonLink>} />
        </div>
      ) : (
        sections.map((s, i) => <HomeSection key={s.id} section={s} locale={locale} first={i === 0} />)
      )}
    </>
  );
}
