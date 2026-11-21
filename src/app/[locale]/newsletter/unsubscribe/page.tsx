import type { Metadata } from "next";
import { pageContext } from "@/i18n/server";
import { AuthShell } from "@/features/auth/auth-shell";
import { TokenActionForm } from "@/features/newsletter/token-action-form";
import { unsubscribeNewsletterAction } from "@/features/newsletter/actions";
import { Alert } from "@/components/ui/feedback";
import { firstParam, type LocalePageProps } from "@/features/account/page-props";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.newsletter.unsubscribeTitle, robots: { index: false, follow: false } };
}

export default async function NewsletterUnsubscribePage(props: LocalePageProps) {
  const { t } = await pageContext(props.params);
  const token = firstParam((await props.searchParams).token) ?? "";
  return (
    <AuthShell title={t.newsletter.unsubscribeTitle}>
      {token ? (
        <TokenActionForm token={token} label={t.newsletter.unsubscribeCta} action={unsubscribeNewsletterAction} />
      ) : (
        <Alert tone="danger">{t.newsletter.invalidToken}</Alert>
      )}
    </AuthShell>
  );
}
