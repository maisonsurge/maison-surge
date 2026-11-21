import type { Metadata } from "next";
import type { LocalePageProps } from "@/features/account/page-props";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { AuthShell } from "@/features/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.auth.registerTitle, robots: { index: false, follow: false } };
}

/** Neutral outcome after sign-up (identical for new and existing addresses). */
export default async function CheckEmailPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  return (
    <AuthShell title={t.auth.registerTitle}>
      <div role="status" className="space-y-6 text-center">
        <p className="text-sm leading-relaxed">{t.auth.registered}</p>
        <ButtonLink href={localePath(locale, "/auth/login")} variant="outline" className="w-full">
          {t.auth.login}
        </ButtonLink>
      </div>
    </AuthShell>
  );
}
