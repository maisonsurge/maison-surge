import type { ReactNode } from "react";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { requireUser } from "@/server/auth";
import { AccountNav } from "@/features/account/account-nav";

export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, t } = await pageContext(params);
  // Pages re-check individually; this guards the shared chrome.
  await requireUser(locale, localePath(locale, "/account"));
  return (
    <div className="container-ms py-10 md:py-14">
      <p className="eyebrow mb-2 text-olive">MAISON SURGE</p>
      <h1 className="mb-8 text-3xl md:text-4xl">{t.account.title}</h1>
      <div className="grid gap-8 md:grid-cols-[200px_1fr] md:gap-12">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
