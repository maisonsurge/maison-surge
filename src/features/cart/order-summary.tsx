import type { Totals } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { format, getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export function TotalsTable({ totals, locale, shippingKnown }: { totals: Totals; locale: Locale; shippingKnown: boolean }) {
  const t = getDictionary(locale);
  return (
    <dl className="space-y-3 text-sm" data-testid="totals">
      <div className="flex justify-between">
        <dt>{t.cart.subtotal}</dt>
        <dd className="tabular-nums">{formatMoney(totals.subtotal, locale)}</dd>
      </div>
      {totals.discount > 0 ? (
        <div className="flex justify-between text-burgundy">
          <dt>{t.cart.discount}</dt>
          <dd className="tabular-nums">−{formatMoney(totals.discount, locale)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt>{t.cart.shipping}</dt>
        <dd className="tabular-nums">{shippingKnown ? (totals.shipping === 0 ? t.cart.free : formatMoney(totals.shipping, locale)) : <span className="text-muted">{t.cart.shippingAtCheckout}</span>}</dd>
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
        <dt>{t.cart.total}</dt>
        <dd className="tabular-nums" data-testid="grand-total">
          {formatMoney(totals.grandTotal, locale)}
        </dd>
      </div>
      {totals.vatIncluded > 0 ? <p className="text-right text-xs text-muted">{format(t.cart.vatIncluded, { amount: formatMoney(totals.vatIncluded, locale) })}</p> : null}
      {shippingKnown && totals.freeShippingRemaining ? (
        <p className="text-xs text-olive">{format(t.cart.freeShippingRemaining, { amount: formatMoney(totals.freeShippingRemaining, locale) })}</p>
      ) : null}
    </dl>
  );
}
