import type { Metadata } from "next";
import { OrderView } from "@/features/orders/order-view";
import { PendingRefresher } from "@/features/checkout/pending-refresher";
import { retryPaymentAction } from "@/features/checkout/actions";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { getOrderForGuest, getOrderForUser } from "@/server/orders";
import { isOrderPayable, resolveOrderAccess } from "@/server/checkout";
import { getSessionUser } from "@/server/auth";
import { pageContext } from "@/i18n/server";
import { format } from "@/i18n";
import { localePath } from "@/i18n/config";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Order result / status page. Shows the state recorded by the server — the
 * browser arriving here is never treated as proof of payment.
 */
export default async function OrderStatusPage({ params, searchParams }: PageProps<"/[locale]/order/[orderNumber]">) {
  const { locale, t } = await pageContext(params);
  const { orderNumber } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : null;
  const access = await resolveOrderAccess(orderNumber, token);

  if (!access) {
    const user = await getSessionUser();
    return (
      <div className="container-ms py-20 text-center">
        <h1 className="font-display text-3xl">{t.order.notFound}</h1>
        {!user ? (
          <ButtonLink className="mt-8" href={`${localePath(locale, "/auth/login")}?next=${encodeURIComponent(localePath(locale, `/order/${orderNumber}`))}`}>
            {t.common.signIn}
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  const order = access.via === "user" ? await getOrderForUser(orderNumber) : await getOrderForGuest(orderNumber, access.guestToken!);
  const payable = isOrderPayable(access);
  const awaiting = access.status === "pending_payment" && access.paymentStatus === "pending";
  const paymentError = typeof sp.payment === "string" ? sp.payment : null;

  const headline = (() => {
    switch (access.status) {
      case "confirmed":
      case "processing":
      case "shipped":
      case "delivered":
        return { tone: "success" as const, title: t.order.thanks, body: t.order.paidBody };
      case "expired":
        return { tone: "neutral" as const, title: t.order.statuses.expired, body: t.order.expiredBody };
      case "cancelled":
      case "refunded":
        return { tone: "neutral" as const, title: t.order.statuses[access.status], body: t.order.cancelledBody };
      case "on_hold":
        return { tone: "warning" as const, title: t.order.statuses.on_hold, body: t.order.onHoldBody };
      default:
        return access.paymentStatus === "failed"
          ? { tone: "danger" as const, title: t.order.paymentStatuses.failed, body: t.order.failedBody }
          : { tone: "warning" as const, title: t.order.statuses.pending_payment, body: t.order.pendingBody };
    }
  })();

  const guestLink = access.via === "guest" && access.guestToken ? `${publicEnv.siteUrl}${localePath(locale, `/order/${orderNumber}`)}?t=${encodeURIComponent(access.guestToken)}` : null;

  return (
    <div className="container-ms py-10 md:py-14" data-testid="order-status" data-status={access.status} data-payment={access.paymentStatus}>
      {awaiting ? <PendingRefresher /> : null}
      <h1 className="font-display text-4xl">{format(t.order.title, { number: orderNumber })}</h1>
      <Alert tone={headline.tone} title={headline.title} className="mt-6" role="status">
        {headline.body}
      </Alert>
      {paymentError === "payment_unavailable" ? (
        <Alert tone="danger" className="mt-4">
          {t.checkout.errors.payment_unavailable}
        </Alert>
      ) : paymentError === "order_expired" ? (
        <Alert tone="danger" className="mt-4">
          {t.payment.expired}
        </Alert>
      ) : null}
      {payable && !awaiting ? (
        <form action={retryPaymentAction} className="mt-6">
          <input type="hidden" name="orderNumber" value={orderNumber} />
          <input type="hidden" name="locale" value={locale} />
          {access.guestToken ? <input type="hidden" name="t" value={access.guestToken} /> : null}
          <SubmitButton pendingLabel={t.payment.redirecting} data-testid="retry-payment">
            {access.paymentStatus === "failed" ? t.payment.retry : t.payment.startPayment}
          </SubmitButton>
        </form>
      ) : null}
      {guestLink ? (
        <div className="mt-6 border border-line bg-sand-50 p-4 text-xs">
          <p>{t.order.guestLinkNotice}</p>
          <p className="mt-2 font-mono break-all select-all">{guestLink}</p>
        </div>
      ) : null}
      <div className="mt-10">{order ? <OrderView order={order} locale={locale} /> : null}</div>
    </div>
  );
}
