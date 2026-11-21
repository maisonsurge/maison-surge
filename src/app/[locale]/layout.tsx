import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { SetupRequired } from "@/components/layout/setup-required";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { isSupabaseConfigured } from "@/lib/env";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { description: t.meta.description, ...buildMetadata({ locale, path: "/", description: t.meta.description }), title: { default: "MAISON SURGE", template: "%s — MAISON SURGE" } };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getDictionary(locale);

  if (!isSupabaseConfigured()) {
    return (
      <I18nProvider locale={locale} dictionary={t}>
        <SetupRequired t={t} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider locale={locale} dictionary={t}>
      <a href="#main" className="sr-only z-[70] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t.common.skipToContent}
      </a>
      <div className="flex min-h-dvh flex-col">
        <Header locale={locale} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
      </div>
      <CookieConsent />
    </I18nProvider>
  );
}
