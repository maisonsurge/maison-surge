import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { getContentPage } from "@/server/catalog";
import { Alert } from "@/components/ui/feedback";
import { formatDate, isSafeRelativePath } from "@/lib/utils";
import type { LocaleParamPageProps } from "@/features/account/page-props";

type Props = LocaleParamPageProps<"slug">;

function excerpt(markdown: string): string {
  return markdown
    .replace(/[#>*_`|[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale } = await pageContext(props.params);
  const { slug } = await props.params;
  const page = await getContentPage(slug, locale);
  if (!page) return { robots: { index: false } };
  return {
    title: page.title,
    description: excerpt(page.body) || undefined,
    alternates: {
      canonical: localePath(locale, `/pages/${slug}`),
      languages: { tr: `/tr/pages/${slug}`, en: `/en/pages/${slug}` },
    },
    // Drafts awaiting legal approval should not be indexed.
    robots: page.needsLegalReview ? { index: false, follow: true } : undefined,
  };
}

export default async function ContentPage(props: Props) {
  const { locale, t } = await pageContext(props.params);
  const { slug } = await props.params;
  const page = await getContentPage(slug, locale);
  if (!page) notFound();

  return (
    <article className="container-ms py-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-2 text-olive">MAISON SURGE</p>
        <h1 className="mb-3 text-3xl md:text-5xl">{page.title}</h1>
        <p className="mb-8 text-xs text-muted">{formatDate(page.updatedAt, locale)}</p>
        {page.needsLegalReview ? (
          <Alert tone="warning" className="mb-8">
            {t.pages.draftNotice}
          </Alert>
        ) : null}
        <div className="prose-ms">
          {/* react-markdown escapes raw HTML by default (no rehype-raw) → safe rendering. */}
          <ReactMarkdown
            components={{
              a: ({ href, children }) =>
                href && isSafeRelativePath(href) ? (
                  <Link href={href}>{children}</Link>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                    {children}
                  </a>
                ),
            }}
          >
            {page.body}
          </ReactMarkdown>
        </div>
      </div>
    </article>
  );
}
