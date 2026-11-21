import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CouponForm, QuantityControl } from "@/features/cart/cart-controls";
import { TotalsTable } from "@/features/cart/order-summary";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { getCartSummary } from "@/server/cart";
import { getActiveShippingMethods, getSiteSettings } from "@/server/catalog";
import { pageContext } from "@/i18n/server";
import { format } from "@/i18n";
import { localePath } from "@/i18n/config";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/cart">): Promise<Metadata> {
  const { locale, t } = await pageContext(params);
  return buildMetadata({ locale, path: "/cart", title: t.cart.title, noindex: true });
}

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const { locale, t } = await pageContext(params);
  const [settings, methods] = await Promise.all([getSiteSettings(), getActiveShippingMethods(locale)]);
  // Preview with the first active shipping method so the free-shipping hint is accurate.
  const preview = methods[0] ? { price: methods[0].price, free_over: methods[0].free_over } : null;
  const cart = await getCartSummary(locale, { shipping: preview, vatRateBps: settings?.vat_rate_bps });
  const hasIssues = cart.lines.some((l) => !l.purchasable || l.quantity > l.available);

  return (
    <div className="container-ms py-10 md:py-14">
      <h1 className="font-display text-4xl md:text-5xl">{t.cart.title}</h1>
      {cart.lines.length === 0 ? (
        <EmptyState className="mt-10" title={t.cart.empty} action={<ButtonLink href={localePath(locale, "/shop")}>{t.cart.emptyCta}</ButtonLink>} />
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
          <section aria-label={t.cart.title}>
            {hasIssues ? (
              <Alert tone="warning" className="mb-6">
                {t.checkout.errors.insufficient_stock}
              </Alert>
            ) : null}
            <ul className="divide-y divide-line border-y border-line" data-testid="cart-lines">
              {cart.lines.map((line) => {
                const img = imageUrl(line.imagePath);
                const href = localePath(locale, `/product/${line.slug}`);
                return (
                  <li key={line.itemId} className="flex gap-4 py-6" data-testid="cart-line">
                    <Link href={href} className="relative h-32 w-24 shrink-0 overflow-hidden bg-sand-100 sm:h-40 sm:w-32">
                      {img ? <Image src={img} alt={line.imageAlt} fill sizes="128px" unoptimized={isUnoptimizable(img)} className="object-cover" /> : null}
                    </Link>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link href={href} className="font-medium hover:underline">
                            {line.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted">
                            {[line.colorName, line.sizeLabel].filter(Boolean).join(" / ")} · {line.sku}
                          </p>
                        </div>
                        <Price amount={line.unitPrice * line.quantity} locale={locale} className="text-sm" />
                      </div>
                      {!line.purchasable ? (
                        <p className="text-xs text-danger" role="alert">
                          {line.available <= 0 ? t.product.outOfStock : t.cart.unavailable}
                        </p>
                      ) : line.quantity > line.available ? (
                        <p className="text-xs text-warning" role="alert">
                          {format(t.cart.maxQuantity, { count: line.available })}
                        </p>
                      ) : null}
                      <div className="mt-auto">
                        <QuantityControl itemId={line.itemId} quantity={line.quantity} max={Math.min(line.available, 20)} name={line.name} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="h-fit space-y-6 bg-sand-50 p-6 lg:sticky lg:top-28" aria-label={t.checkout.summary}>
            <CouponForm appliedCode={cart.couponCode} rejected={cart.couponRejected} />
            <TotalsTable totals={cart.totals} locale={locale} shippingKnown={Boolean(preview)} />
            {cart.totals.subtotal > 0 ? (
              <ButtonLink href={localePath(locale, "/checkout")} size="lg" className="w-full" data-testid="go-checkout">
                {t.cart.checkout}
              </ButtonLink>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
