import type { Metadata } from "next";
import Link from "next/link";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { requireUser } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { applyPendingSignupConsent } from "@/server/account";
import { listOrdersForUser } from "@/server/orders";
import { ProfileForm } from "@/features/account/profile-form";
import { Alert, Badge } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_TONE } from "@/lib/orders/transitions";
import type { LocalePageProps } from "@/features/account/page-props";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.account.title, robots: { index: false, follow: false } };
}

export default async function AccountOverviewPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  const user = await requireUser(locale, localePath(locale, "/account"));
  const sp = await props.searchParams;

  try {
    await applyPendingSignupConsent();
  } catch {
    // non-critical
  }

  const supabase = await createClient();
  const [{ data: profile }, orders] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, preferred_locale, marketing_consent").eq("id", user.id).maybeSingle(),
    listOrdersForUser(3),
  ]);

  return (
    <div className="space-y-12">
      {sp.updated === "password" ? <Alert tone="success">{t.auth.passwordUpdated}</Alert> : null}

      <section aria-labelledby="recent-orders">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="recent-orders" className="text-2xl">
            {t.account.orders}
          </h2>
          {orders.length > 0 ? (
            <Link href={localePath(locale, "/account/orders")} className="text-xs underline underline-offset-4">
              {t.common.viewAll}
            </Link>
          ) : null}
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">{t.account.noOrders}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((o) => (
              <li key={o.orderNumber}>
                <Link
                  href={localePath(locale, `/account/orders/${o.orderNumber}`)}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm hover:bg-sand-50"
                >
                  <span className="font-medium tabular-nums">{o.orderNumber}</span>
                  <span className="text-muted">{formatDate(o.createdAt, locale)}</span>
                  <Badge tone={ORDER_STATUS_TONE[o.status]}>{t.order.statuses[o.status]}</Badge>
                  <span className="tabular-nums">{formatMoney(o.grandTotal, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="profile">
        <h2 id="profile" className="mb-4 text-2xl">
          {t.account.profile}
        </h2>
        <ProfileForm
          profile={{
            email: user.email,
            full_name: profile?.full_name ?? null,
            phone: profile?.phone ?? null,
            preferred_locale: profile?.preferred_locale === "en" ? "en" : "tr",
            marketing_consent: profile?.marketing_consent ?? false,
          }}
        />
      </section>
    </div>
  );
}
