import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { simulateMockPaymentAction } from "@/features/checkout/sandbox-actions";
import { Alert, Badge } from "@/components/ui/feedback";
import { Button, ButtonLink } from "@/components/ui/button";
import { createServiceClient } from "@/server/supabase/admin";
import { isMockAllowed } from "@/server/payments/mock";
import { isOrderPayable } from "@/server/checkout";
import { formatMoney } from "@/lib/money";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Test payment" };

export default async function SandboxPaymentPage({ params }: PageProps<"/[locale]/checkout/sandbox/[session]">) {
  const { locale, t } = await pageContext(params);
  const { session } = await params;
  if (!isMockAllowed() || !/^ms_[A-Za-z0-9_-]{20,64}$/.test(session)) notFound();

  const db = createServiceClient();
  const { data: payment } = await db
    .from("payments")
    .select("status, amount, orders ( order_number, status, payment_status, reservation_expires_at )")
    .eq("provider", "mock")
    .eq("provider_session_id", session)
    .maybeSingle();
  if (!payment?.orders) notFound();
  const order = payment.orders;
  const payable = payment.status === "pending" && isOrderPayable({ status: order.status, paymentStatus: order.payment_status, reservationExpiresAt: order.reservation_expires_at });

  return (
    <div className="container-ms flex justify-center py-16">
      <section className="w-full max-w-md border border-line bg-paper p-8" aria-labelledby="sandbox-title" data-testid="sandbox">
        <Badge tone="warning">{t.common.testMode}</Badge>
        <h1 id="sandbox-title" className="mt-4 font-display text-3xl">
          {t.payment.sandboxTitle}
        </h1>
        <Alert tone="warning" className="mt-4">
          {t.payment.sandboxBody}
        </Alert>
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">#</dt>
            <dd className="font-medium">{order.order_number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t.cart.total}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(payment.amount, locale)}</dd>
          </div>
        </dl>
        {payable ? (
          <form action={simulateMockPaymentAction} className="mt-8 flex flex-col gap-3">
            <input type="hidden" name="session" value={session} />
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" name="outcome" value="succeed" size="lg" data-testid="sandbox-succeed">
              {t.payment.sandboxSucceed}
            </Button>
            <Button type="submit" name="outcome" value="fail" variant="danger" data-testid="sandbox-fail">
              {t.payment.sandboxFail}
            </Button>
            <Button type="submit" name="outcome" value="cancel" variant="ghost">
              {t.payment.sandboxCancel}
            </Button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted">{t.payment.notPayable}</p>
            <ButtonLink href={localePath(locale, `/order/${order.order_number}`)} variant="outline">
              {t.common.continue}
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
