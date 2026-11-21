import type { Metadata } from "next";
import type { LocalePageProps } from "@/features/account/page-props";
import { pageContext } from "@/i18n/server";
import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forms";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.auth.forgotTitle, robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage(props: LocalePageProps) {
  const { t } = await pageContext(props.params);
  return (
    <AuthShell title={t.auth.forgotTitle}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
