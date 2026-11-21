import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/i18n/server";
import { format, localePath } from "@/i18n";
import { requireUser } from "@/server/auth";
import { getOrderForUser } from "@/server/orders";
import { OrderView } from "@/features/orders/order-view";
import type { LocaleParamPageProps } from "@/features/account/page-props";

type Props = LocaleParamPageProps<"orderNumber">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { t } = await pageContext(props.params);
  const { orderNumber } = await props.params;
  return { title: format(t.order.title, { number: orderNumber }), robots: { index: false, follow: false } };
}

export default async function AccountOrderPage(props: Props) {
  const { locale, t } = await pageContext(props.params);
  const { orderNumber } = await props.params;
  await requireUser(locale, localePath(locale, `/account/orders/${orderNumber}`));
  const order = await getOrderForUser(decodeURIComponent(orderNumber));
  if (!order) notFound();

  return (
    <div>
      <Link href={localePath(locale, "/account/orders")} className="text-xs underline underline-offset-4">
        ← {t.account.orders}
      </Link>
      <h2 className="mt-4 mb-6 text-2xl md:text-3xl">{format(t.order.title, { number: order.orderNumber })}</h2>
      <OrderView order={order} locale={locale} />
    </div>
  );
}
