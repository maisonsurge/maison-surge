"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { placeOrderAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";
import { format } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/config";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

type Address = { id: string; label: string | null; full_name: string; phone: string; line1: string; line2: string | null; district: string; city: string; postal_code: string | null; is_default: boolean };
type MethodTotals = { id: string; name: string; description: string; shipping: number; grandTotal: number; vatIncluded: number };

export function CheckoutForm({
  idempotencyKey,
  defaultEmail,
  signedIn,
  addresses,
  methods,
  subtotal,
  discount,
  isTestPayment,
}: {
  idempotencyKey: string;
  defaultEmail: string;
  signedIn: boolean;
  addresses: Address[];
  methods: MethodTotals[];
  subtotal: number;
  discount: number;
  isTestPayment: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(placeOrderAction, initialActionState);
  const [billingSame, setBillingSame] = useState(true);
  const [billingType, setBillingType] = useState<"individual" | "corporate">("individual");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const initialAddr = addresses.find((a) => a.is_default) ?? addresses[0] ?? null;
  const [addr, setAddr] = useState<Address | null>(initialAddr);
  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  const e = state.errors ?? {};

  const addressFields = (prefix: "ship" | "bill", group: "shipping" | "billing", defaults: Partial<Address> | null) => (
    <div className="grid gap-4 sm:grid-cols-2" key={`${prefix}-${defaults && "id" in defaults ? defaults.id : "new"}`}>
      <Field name={`${prefix}_full_name`} label={t.checkout.fullName} error={e[`${group}.full_name`]} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete={`${prefix === "ship" ? "shipping" : "billing"} name`} defaultValue={defaults?.full_name ?? ""} required />}
      </Field>
      <Field name={`${prefix}_phone`} label={t.checkout.phone} error={e[`${group}.phone`] ?? (prefix === "ship" ? e.phone : undefined)}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" defaultValue={defaults?.phone ?? ""} placeholder="+90 5xx xxx xx xx" required />}
      </Field>
      <Field name={`${prefix}_postal_code`} label={`${t.checkout.postalCode} (${t.common.optional})`} error={e[`${group}.postal_code`]}>
        {(p) => <Input {...p} inputMode="numeric" autoComplete="postal-code" maxLength={5} defaultValue={defaults?.postal_code ?? ""} />}
      </Field>
      <Field name={`${prefix}_line1`} label={t.checkout.line1} error={e[`${group}.line1`]} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="address-line1" defaultValue={defaults?.line1 ?? ""} required />}
      </Field>
      <Field name={`${prefix}_line2`} label={`${t.checkout.line2} (${t.common.optional})`} error={e[`${group}.line2`]} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="address-line2" defaultValue={defaults?.line2 ?? ""} />}
      </Field>
      <Field name={`${prefix}_district`} label={t.checkout.district} error={e[`${group}.district`]}>
        {(p) => <Input {...p} autoComplete="address-level2" defaultValue={defaults?.district ?? ""} required />}
      </Field>
      <Field name={`${prefix}_city`} label={t.checkout.city} error={e[`${group}.city`]}>
        {(p) => <Input {...p} autoComplete="address-level1" defaultValue={defaults?.city ?? ""} required />}
      </Field>
    </div>
  );

  const legalLink = (slug: string, label: string) => (
    <Link href={localePath(locale, `/pages/${slug}`)} target="_blank" className="underline underline-offset-4">
      {label}
    </Link>
  );
  const [beforePre, afterPre] = t.checkout.acceptTerms.split("{preInfo}");
  const [middle, end] = (afterPre ?? "").split("{distance}");

  return (
    <form action={action} className="grid gap-12 lg:grid-cols-[1fr_400px]" noValidate data-testid="checkout-form">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="shipping_method_id" value={methodId} />

      <div className="space-y-10">
        {state.message && !state.ok ? (
          <Alert tone="danger" title={state.message}>
            {Object.keys(e).length === 0 ? (
              <Link href={localePath(locale, "/cart")} className="underline underline-offset-4">
                {t.cart.title}
              </Link>
            ) : null}
          </Alert>
        ) : null}

        <section aria-labelledby="co-contact">
          <h2 id="co-contact" className="font-display text-2xl">
            {t.checkout.contact}
          </h2>
          {!signedIn ? (
            <p className="mt-2 text-sm text-muted">
              {t.checkout.guestNotice}{" "}
              <Link href={`${localePath(locale, "/auth/login")}?next=${encodeURIComponent(localePath(locale, "/checkout"))}`} className="underline underline-offset-4">
                {t.checkout.haveAccount} {t.common.signIn}
              </Link>
            </p>
          ) : null}
          <div className="mt-5">
            <Field name="email" label={t.checkout.email} error={e.email}>
              {(p) => <Input {...p} type="email" autoComplete="email" defaultValue={defaultEmail} readOnly={signedIn} required />}
            </Field>
          </div>
        </section>

        <section aria-labelledby="co-ship">
          <h2 id="co-ship" className="font-display text-2xl">
            {t.checkout.shippingAddress}
          </h2>
          {addresses.length > 0 ? (
            <div className="mt-4">
              <label htmlFor="saved-address" className="mb-1.5 block text-xs font-medium">
                {t.checkout.savedAddresses}
              </label>
              <Select id="saved-address" value={addr?.id ?? ""} onChange={(ev) => setAddr(addresses.find((a) => a.id === ev.target.value) ?? null)}>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.label ? `${a.label} — ` : "") + `${a.full_name}, ${a.district}/${a.city}`}
                  </option>
                ))}
                <option value="">+ {t.account.addAddress}</option>
              </Select>
            </div>
          ) : null}
          <div className="mt-5">{addressFields("ship", "shipping", addr)}</div>
          {signedIn ? <Checkbox id="save_address" name="save_address" className="mt-4" label={t.account.addAddress} /> : null}
        </section>

        <section aria-labelledby="co-bill" className="space-y-4">
          <h2 id="co-bill" className="font-display text-2xl">
            {t.checkout.billingAddress}
          </h2>
          <Checkbox id="billing_same" name="billing_same" checked={billingSame} onChange={(ev) => setBillingSame(ev.target.checked)} label={t.checkout.sameAsShipping} />
          {!billingSame ? addressFields("bill", "billing", null) : null}
          <fieldset>
            <legend className="mb-2 text-xs font-medium">{t.checkout.billingType}</legend>
            <div className="flex gap-6 text-sm">
              {(["individual", "corporate"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="billing_type" value={v} checked={billingType === v} onChange={() => setBillingType(v)} className="accent-[var(--color-olive)]" />
                  {v === "individual" ? t.checkout.individual : t.checkout.corporate}
                </label>
              ))}
            </div>
          </fieldset>
          {billingType === "corporate" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field name="company_name" label={t.checkout.companyName} error={e.company_name} className="sm:col-span-3">
                {(p) => <Input {...p} autoComplete="organization" required />}
              </Field>
              <Field name="tax_office" label={t.checkout.taxOffice} error={e.tax_office} className="sm:col-span-2">
                {(p) => <Input {...p} required />}
              </Field>
              <Field name="tax_number" label={t.checkout.taxNumber} error={e.tax_number}>
                {(p) => <Input {...p} inputMode="numeric" maxLength={11} required />}
              </Field>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="co-method">
          <h2 id="co-method" className="font-display text-2xl">
            {t.checkout.deliveryMethod}
          </h2>
          <div className="mt-4 space-y-2" role="radiogroup" aria-labelledby="co-method">
            {methods.map((m) => (
              <label key={m.id} className={cn("flex cursor-pointer items-start justify-between gap-4 border p-4", m.id === methodId ? "border-ink" : "border-line")}>
                <span className="flex items-start gap-3">
                  <input type="radio" name="_method" checked={m.id === methodId} onChange={() => setMethodId(m.id)} className="mt-1 accent-[var(--color-olive)]" />
                  <span>
                    <span className="block text-sm font-medium">{m.name}</span>
                    {m.description ? <span className="mt-1 block text-xs text-muted">{m.description}</span> : null}
                  </span>
                </span>
                <span className="text-sm tabular-nums">{m.shipping === 0 ? t.cart.free : formatMoney(m.shipping, locale)}</span>
              </label>
            ))}
          </div>
          {e.shipping_method_id ? <p className="mt-2 text-xs text-danger">{e.shipping_method_id[0]}</p> : null}
        </section>

        <section>
          <Field name="customer_note" label={`${t.checkout.note} (${t.common.optional})`} error={e.customer_note}>
            {(p) => <Textarea {...p} maxLength={500} rows={3} />}
          </Field>
        </section>
      </div>

      <aside className="h-fit space-y-6 bg-sand-50 p-6 lg:sticky lg:top-28" aria-label={t.checkout.summary}>
        <h2 className="eyebrow">{t.checkout.summary}</h2>
        {method ? (
          <dl className="space-y-3 text-sm" data-testid="checkout-totals">
            <div className="flex justify-between">
              <dt>{t.cart.subtotal}</dt>
              <dd className="tabular-nums">{formatMoney(subtotal, locale)}</dd>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-burgundy">
                <dt>{t.cart.discount}</dt>
                <dd className="tabular-nums">−{formatMoney(discount, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>{t.cart.shipping}</dt>
              <dd className="tabular-nums">{method.shipping === 0 ? t.cart.free : formatMoney(method.shipping, locale)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>{t.cart.total}</dt>
              <dd className="tabular-nums" data-testid="checkout-grand-total">
                {formatMoney(method.grandTotal, locale)}
              </dd>
            </div>
            {method.vatIncluded > 0 ? <p className="text-right text-xs text-muted">{format(t.cart.vatIncluded, { amount: formatMoney(method.vatIncluded, locale) })}</p> : null}
          </dl>
        ) : null}
        <div className="text-xs leading-relaxed">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-olive)]" aria-invalid={Boolean(e.terms)} aria-describedby={e.terms ? "terms-error" : undefined} data-testid="terms" />
            <span>
              {beforePre}
              {legalLink("on-bilgilendirme-formu", t.footer.preInfo)}
              {middle}
              {legalLink("mesafeli-satis-sozlesmesi", t.footer.distanceSales)}
              {end}
            </span>
          </label>
          {e.terms ? (
            <p id="terms-error" className="mt-2 text-danger" role="alert">
              {e.terms[0]}
            </p>
          ) : null}
        </div>
        {isTestPayment ? <Alert tone="warning">{t.payment.sandboxBody}</Alert> : null}
        <SubmitButton size="lg" className="w-full" pendingLabel={t.checkout.placing} disabled={!method} data-testid="place-order">
          {t.checkout.placeOrder}
        </SubmitButton>
      </aside>
    </form>
  );
}
