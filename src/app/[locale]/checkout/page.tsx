import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Image from "next/image";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { getCartSummary } from "@/server/cart";
import { getActiveShippingMethods, getSiteSettings } from "@/server/catalog";
import { getSessionUser } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { paymentModeInfo } from "@/server/payments";
import { computeTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { buildMetadata } from "@/lib/seo";
import { pageContext } from "@/i18n/server";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale, t } = await pageContext(params);
  return buildMetadata({ locale, path: "/checkout", title: t.checkout.title, noindex: true });
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const { locale, t } = await pageContext(params);
  const user = await getSessionUser();
  const [settings, methods, payment] = await Promise.all([getSiteSettings(), getActiveShippingMethods(locale), Promise.resolve(paymentModeInfo())]);
  const cart = await getCartSummary(locale, { vatRateBps: settings?.vat_rate_bps, email: user?.email });
  const purchasable = cart.lines.filter((l) => l.purchasable);

  if (cart.lines.length === 0) {
    return (
      <div className="container-ms py-14">
        <EmptyState title={t.cart.empty} action={<ButtonLink href={localePath(locale, "/shop")}>{t.cart.emptyCta}</ButtonLink>} />
      </div>
    );
  }

  const lines = purchasable.map((l) => ({ unitPrice: l.unitPrice, quantity: Math.min(l.quantity, l.available) }));
  const methodTotals = methods.map((m) => {
    const totals = computeTotals({ lines, coupon: cart.coupon, shipping: { price: m.price, free_over: m.free_over }, vatRateBps: settings?.vat_rate_bps });
    return { id: m.id, name: m.nameText, description: m.descriptionText, shipping: totals.shipping, grandTotal: totals.grandTotal, vatIncluded: totals.vatIncluded };
  });

  let addresses: Parameters<typeof CheckoutForm>[0]["addresses"] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("addresses")
      .select("id, label, full_name, phone, line1, line2, district, city, postal_code, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    addresses = data ?? [];
  }
  const hasIssues = cart.lines.some((l) => !l.purchasable || l.quantity > l.available);

  return (
    <div className="container-ms py-10 md:py-14">
      <h1 className="font-display text-4xl md:text-5xl">{t.checkout.title}</h1>
      {!payment.available ? (
        <Alert tone="danger" className="mt-6">
          {t.payment.liveNotConfigured}
        </Alert>
      ) : null}
      {hasIssues ? (
        <Alert tone="warning" className="mt-6">
          {t.checkout.errors.insufficient_stock}{" "}
          <a href={localePath(locale, "/cart")} className="underline underline-offset-4">
            {t.cart.title}
          </a>
        </Alert>
      ) : null}
      {methods.length === 0 ? (
        <Alert tone="danger" className="mt-6">
          {t.checkout.errors.shipping_method_invalid}
        </Alert>
      ) : null}
      <ul className="mt-8 flex gap-3 overflow-x-auto pb-2" aria-label={t.checkout.summary}>
        {purchasable.map((l) => {
          const img = imageUrl(l.imagePath);
          return (
            <li key={l.itemId} className="flex shrink-0 items-center gap-3 border border-line p-2 pr-4 text-xs">
              <span className="relative block h-16 w-12 overflow-hidden bg-sand-100">
                {img ? <Image src={img} alt={l.imageAlt} fill sizes="48px" unoptimized={isUnoptimizable(img)} className="object-cover" /> : null}
              </span>
              <span>
                <span className="block font-medium">{l.name}</span>
                <span className="text-muted">
                  {[l.colorName, l.sizeLabel].filter(Boolean).join(" / ")} × {l.quantity} · {formatMoney(l.unitPrice * l.quantity, locale)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-8">
        <CheckoutForm
          idempotencyKey={randomUUID()}
          defaultEmail={user?.email ?? ""}
          signedIn={Boolean(user)}
          addresses={addresses}
          methods={methodTotals}
          subtotal={cart.totals.subtotal}
          discount={cart.totals.discount}
          isTestPayment={payment.isTest}
        />
      </div>
    </div>
  );
}
