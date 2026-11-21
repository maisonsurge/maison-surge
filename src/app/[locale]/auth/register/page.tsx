import type { Metadata } from "next";
import type { LocalePageProps } from "@/features/account/page-props";
import { redirect } from "next/navigation";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { getSessionUser } from "@/server/auth";
import { AuthShell } from "@/features/auth/auth-shell";
import { RegisterForm } from "@/features/auth/forms";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.auth.registerTitle, robots: { index: false, follow: false } };
}

export default async function RegisterPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  if (await getSessionUser()) redirect(localePath(locale, "/account"));
  return (
    <AuthShell title={t.auth.registerTitle}>
      <RegisterForm />
    </AuthShell>
  );
}
