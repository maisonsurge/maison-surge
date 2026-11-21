import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NewsletterForm } from "@/features/newsletter/newsletter-form";
import { getCategories, getSiteSettings } from "@/server/catalog";
import { getDictionary } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { CookiePreferencesButton } from "./cookie-consent";

export async function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const [categories, settings] = await Promise.all([getCategories(locale), getSiteSettings()]);
  const p = (slug: string) => localePath(locale, `/pages/${slug}`);
  const social = (settings?.social_links ?? {}) as Record<string, string | undefined>;
  const socialLinks = (["instagram", "x", "tiktok", "youtube"] as const)
    .map((k) => ({ k, href: social[k] }))
    .filter((s): s is { k: (typeof s)["k"]; href: string } => typeof s.href === "string" && s.href.startsWith("https://"));

  const columns = [
    {
      title: t.nav.shop,
      links: [{ href: localePath(locale, "/shop"), label: t.nav.allProducts }, ...categories.filter((c) => !c.parent_id).map((c) => ({ href: localePath(locale, `/shop/${c.slug}`), label: c.name }))],
    },
    {
      title: t.footer.help,
      links: [
        { href: p("sss"), label: t.footer.faq },
        { href: p("teslimat-ve-iade"), label: t.footer.delivery },
        { href: localePath(locale, "/contact"), label: t.nav.contact },
        { href: p("hakkimizda"), label: t.nav.about },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: p("gizlilik-politikasi"), label: t.footer.privacy },
        { href: p("kvkk-aydinlatma-metni"), label: t.footer.kvkk },
        { href: p("cerez-politikasi"), label: t.footer.cookies },
        { href: p("mesafeli-satis-sozlesmesi"), label: t.footer.distanceSales },
        { href: p("on-bilgilendirme-formu"), label: t.footer.preInfo },
      ],
    },
  ];

  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="container-ms grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo tone="dark" />
          <p className="mt-6 eyebrow text-sand">{t.newsletter.title}</p>
          <div className="mt-4">
            <NewsletterForm source="footer" variant="dark" />
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="eyebrow text-sand">{col.title}</p>
            <ul className="mt-5 space-y-3 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-paper/85 hover:text-paper hover:underline hover:underline-offset-4">
                    {l.label}
                  </Link>
                </li>
              ))}
              {col.title === t.footer.legal ? (
                <li>
                  <CookiePreferencesButton className="text-paper/85 hover:text-paper hover:underline hover:underline-offset-4" />
                </li>
              ) : null}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-paper/15">
        <div className="container-ms flex flex-col gap-3 py-6 text-xs text-paper/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings?.store_name ?? "MAISON SURGE"}. {t.footer.rights}
          </p>
          {socialLinks.length > 0 ? (
            <ul className="flex gap-4">
              {socialLinks.map((s) => (
                <li key={s.k}>
                  <a href={s.href} rel="noopener noreferrer" target="_blank" className="uppercase tracking-wider hover:text-paper">
                    {s.k}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
