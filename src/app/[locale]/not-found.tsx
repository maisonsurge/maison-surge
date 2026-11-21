import { headers } from "next/headers";
import { ButtonLink } from "@/components/ui/button";
import { getDictionary } from "@/i18n";
import { asLocale, localePath } from "@/i18n/config";

export default async function LocaleNotFound() {
  const locale = asLocale((await headers()).get("x-ms-locale"));
  const t = getDictionary(locale);
  return (
    <section className="container-ms flex flex-col items-center py-28 text-center" data-testid="not-found">
      <p className="eyebrow text-muted">404</p>
      <h1 className="mt-4 font-display text-4xl md:text-5xl">{t.common.notFoundTitle}</h1>
      <p className="mt-4 max-w-md text-sm text-muted">{t.common.notFoundBody}</p>
      <ButtonLink href={localePath(locale)} className="mt-8">
        {t.common.backHome}
      </ButtonLink>
    </section>
  );
}
