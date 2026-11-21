import Image from "next/image";
import Link from "next/link";
import { getDictionary, localePath, type Locale } from "@/i18n";
import { Badge } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/money";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { formatDate, pickLocale } from "@/lib/utils";
import { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE } from "@/lib/orders/transitions";
import type { OrderAddress, OrderViewData } from "@/server/orders";

function AddressBlock({ title, address }: { title: string; address: OrderAddress }) {
  return (
    <div>
      <h3 className="eyebrow mb-2 text-muted">{title}</h3>
      <address className="text-sm not-italic leading-relaxed">
        {address.full_name ? <span className="block font-medium">{address.full_name}</span> : null}
        {address.line1 ? <span className="block">{address.line1}</span> : null}
        {address.line2 ? <span className="block">{address.line2}</span> : null}
        <span className="block">{[address.postal_code, address.district, address.city].filter(Boolean).join(" ")}</span>
        {address.phone ? <span className="block text-muted">{address.phone}</span> : null}
      </address>
    </div>
  );
}

/** Presentational order summary used by account, guest and checkout-result pages. */
export function OrderView({ order, locale }: { order: OrderViewData; locale: Locale }) {
  const t = getDictionary(locale);
  const money = (n: number) => formatMoney(n, locale, order.currency);
  const shippingName = pickLocale(order.shippingMethodName, locale);
  const billing = order.billingInfo;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">{formatDate(order.createdAt, locale, true)}</span>
        <span className="text-sm text-muted" aria-hidden>
          ·
        </span>
        <span className="text-sm">
          {t.order.status}: <Badge tone={ORDER_STATUS_TONE[order.status]}>{t.order.statuses[order.status]}</Badge>
        </span>
        <span className="text-sm">
          {t.order.paymentStatus}:{" "}
          <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{t.order.paymentStatuses[order.paymentStatus]}</Badge>
        </span>
      </div>

      <section aria-labelledby="order-items">
        <h2 id="order-items" className="mb-4 text-2xl">
          {t.order.items}
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {order.items.map((item) => {
            const src = imageUrl(item.imagePath);
            return (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-sand-100">
                  {src ? (
                    <Image src={src} alt={item.name} fill sizes="80px" className="object-cover" unoptimized={isUnoptimizable(src)} />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 sm:flex-row">
                  <div className="min-w-0">
                    {item.productSlug ? (
                      <Link href={localePath(locale, `/product/${item.productSlug}`)} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <p className="font-medium">{item.name}</p>
                    )}
                    {item.variantLabel ? <p className="text-sm text-muted">{item.variantLabel}</p> : null}
                    <p className="text-xs text-muted">
                      {t.product.sku}: {item.sku}
                    </p>
                  </div>
                  <div className="text-sm tabular-nums sm:text-right">
                    <p>
                      {item.quantity} × {money(item.unitPrice)}
                    </p>
                    <p className="font-medium">{money(item.lineTotal)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="mt-6 ml-auto max-w-sm space-y-2 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt>{t.cart.subtotal}</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 ? (
            <div className="flex justify-between text-burgundy">
              <dt>
                {t.cart.discount}
                {order.couponCode ? ` (${order.couponCode})` : ""}
              </dt>
              <dd>−{money(order.discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>
              {t.cart.shipping}
              {shippingName ? ` — ${shippingName}` : ""}
            </dt>
            <dd>{order.shippingTotal === 0 ? t.cart.free : money(order.shippingTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>{t.cart.total}</dt>
            <dd>{money(order.grandTotal)}</dd>
          </div>
          {order.vatTotal > 0 ? (
            <p className="text-right text-xs text-muted">{t.cart.vatIncluded.replace("{amount}", money(order.vatTotal))}</p>
          ) : null}
          {order.refundedTotal > 0 ? (
            <div className="flex justify-between text-muted">
              <dt>{t.order.paymentStatuses.refunded}</dt>
              <dd>−{money(order.refundedTotal)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="grid gap-8 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-3">
        <AddressBlock title={t.checkout.shippingAddress} address={order.shippingAddress} />
        <div className="space-y-3">
          <AddressBlock title={t.checkout.billingAddress} address={order.billingAddress} />
          {billing.type === "corporate" ? (
            <p className="text-sm leading-relaxed">
              {billing.company_name}
              <br />
              {billing.tax_office} / {billing.tax_number}
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="eyebrow mb-2 text-muted">{t.checkout.contact}</h3>
          <p className="text-sm break-all">{order.email}</p>
          {order.customerNote ? (
            <>
              <h3 className="eyebrow mt-4 mb-2 text-muted">{t.checkout.note}</h3>
              <p className="text-sm whitespace-pre-line">{order.customerNote}</p>
            </>
          ) : null}
        </div>
      </section>

      {order.shipments.length > 0 ? (
        <section aria-labelledby="order-shipments" className="border-t border-line pt-8">
          <h2 id="order-shipments" className="mb-4 text-2xl">
            {t.order.shipment}
          </h2>
          <ul className="space-y-3">
            {order.shipments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{s.carrier}</span>
                <span>
                  {t.order.tracking}: <span className="tabular-nums">{s.trackingNumber}</span>
                </span>
                <span className="text-muted">{formatDate(s.shippedAt, locale)}</span>
                {s.trackingUrl ? (
                  <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4 hover:text-forest">
                    {t.order.trackShipment}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.history.length > 0 ? (
        <section aria-labelledby="order-history" className="border-t border-line pt-8">
          <h2 id="order-history" className="mb-4 text-2xl">
            {t.order.history}
          </h2>
          <ol className="space-y-2 border-l border-line pl-5">
            {order.history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span aria-hidden className="absolute top-1.5 -left-[1.4rem] h-2 w-2 rounded-full bg-olive" />
                <span className="font-medium">{t.order.statuses[h.toStatus]}</span>
                <span className="text-muted"> · {t.order.paymentStatuses[h.paymentStatus]}</span>
                <span className="block text-xs text-muted">{formatDate(h.createdAt, locale, true)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
