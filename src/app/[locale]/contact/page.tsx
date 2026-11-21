import type { Metadata } from "next";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { getSessionUser } from "@/server/auth";
import { getSiteSettings } from "@/server/catalog";
import { ContactForm } from "@/features/contact/contact-form";
import type { LocalePageProps } from "@/features/account/page-props";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { locale, t } = await pageContext(props.params);
  return {
    title: t.contact.title,
    description: t.contact.intro,
    alternates: { canonical: localePath(locale, "/contact"), languages: { tr: "/tr/contact", en: "/en/contact" } },
  };
}

export default async function ContactPage(props: LocalePageProps) {
  const { t } = await pageContext(props.params);
  const [settings, user] = await Promise.all([getSiteSettings(), getSessionUser()]);
  const email = settings?.support_email ?? null;
  const phone = settings?.support_phone ?? null;

  return (
    <div className="container-ms py-10 md:py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
        <div>
          <p className="eyebrow mb-2 text-olive">MAISON SURGE</p>
          <h1 className="mb-4 text-3xl md:text-5xl">{t.contact.title}</h1>
          <p className="mb-8 text-sm leading-relaxed text-muted">{t.contact.intro}</p>
          <h2 className="eyebrow mb-3">{t.contact.details}</h2>
          {email || phone ? (
            <ul className="space-y-1 text-sm">
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className="underline underline-offset-4 hover:text-forest">
                    {email}
                  </a>
                </li>
              ) : null}
              {phone ? (
                <li>
                  <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="underline underline-offset-4 hover:text-forest">
                    {phone}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.contact.notConfigured}</p>
          )}
        </div>
        <div className="border border-line bg-paper p-6 md:p-8">
          <ContactForm defaultEmail={user?.email} />
        </div>
      </div>
    </div>
  );
}
