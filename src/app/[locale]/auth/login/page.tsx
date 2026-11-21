import type { Metadata } from "next";
import type { LocalePageProps } from "@/features/account/page-props";
import { redirect } from "next/navigation";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { getSessionUser } from "@/server/auth";
import { isSafeRelativePath } from "@/lib/utils";
import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/forms";
import { Alert } from "@/components/ui/feedback";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.auth.loginTitle, robots: { index: false, follow: false } };
}

export default async function LoginPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && isSafeRelativePath(sp.next) ? sp.next : undefined;
  if (await getSessionUser()) redirect(next ?? localePath(locale, "/account"));
  const signedOut = sp.signedout === "1";
  return (
    <AuthShell title={t.auth.loginTitle} intro={next ? t.auth.loginRequired : undefined}>
      {signedOut ? <Alert tone="success" className="mb-5">{t.auth.signedOut}</Alert> : null}
      <LoginForm next={next} linkError={sp.error === "link"} />
    </AuthShell>
  );
}
