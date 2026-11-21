import type { Metadata } from "next";
import type { LocalePageProps } from "@/features/account/page-props";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { getSessionUser } from "@/server/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/forms";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.auth.resetTitle, robots: { index: false, follow: false } };
}

/** Reached via the recovery e-mail link → /auth/confirm establishes the session. */
export default async function ResetPasswordPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  const user = await getSessionUser();
  return (
    <AuthShell title={t.auth.resetTitle}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-5">
          <Alert tone="danger">{t.auth.linkInvalid}</Alert>
          <ButtonLink href={localePath(locale, "/auth/forgot-password")} className="w-full">
            {t.auth.sendReset}
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
