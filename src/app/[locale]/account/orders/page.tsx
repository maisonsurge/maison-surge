import type { Metadata } from "next";
import Link from "next/link";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n";
import { requireUser } from "@/server/auth";
import { listOrdersForUser } from "@/server/orders";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE } from "@/lib/orders/transitions";
import type { LocalePageProps } from "@/features/account/page-props";

export async function generateMetadata(props: LocalePageProps): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  return { title: t.account.orders, robots: { index: false, follow: false } };
}

export default async function AccountOrdersPage(props: LocalePageProps) {
  const { locale, t } = await pageContext(props.params);
  await requireUser(locale, localePath(locale, "/account/orders"));
  const orders = await listOrdersForUser(100);

  return (
    <section aria-labelledby="orders-title">
      <h2 id="orders-title" className="mb-6 text-2xl">
        {t.account.orders}
      </h2>
      {orders.length === 0 ? (
        <EmptyState
          title={t.account.noOrders}
          action={
            <ButtonLink href={localePath(locale, "/shop")} variant="outline">
              {t.cart.emptyCta}
            </ButtonLink>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="py-3 pr-4 font-medium">#</th>
                <th scope="col" className="py-3 pr-4 font-medium">{t.account.orderDate}</th>
                <th scope="col" className="py-3 pr-4 font-medium">{t.order.status}</th>
                <th scope="col" className="py-3 pr-4 font-medium">{t.order.paymentStatus}</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">{t.account.orderTotal}</th>
                <th scope="col" className="py-3"><span className="sr-only">{t.account.viewOrder}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.orderNumber}>
                  <td className="py-3 pr-4 font-medium tabular-nums">{o.orderNumber}</td>
                  <td className="py-3 pr-4 text-muted">{formatDate(o.createdAt, locale)}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{t.order.statuses[o.status]}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{t.order.paymentStatuses[o.paymentStatus]}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatMoney(o.grandTotal, locale)}</td>
                  <td className="py-3 text-right">
                    <Link href={localePath(locale, `/account/orders/${o.orderNumber}`)} className="underline underline-offset-4 hover:text-forest">
                      {t.account.viewOrder}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
