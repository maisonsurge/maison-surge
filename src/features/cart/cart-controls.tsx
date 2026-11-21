"use client";

import { useActionState, useTransition } from "react";
import { Minus, Plus, X } from "lucide-react";
import { applyCouponAction, removeCartItemAction, removeCouponAction, updateCartItemAction } from "./actions";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/i18n/client";
import { Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function QuantityControl({ itemId, quantity, max, name }: { itemId: string; quantity: number; max: number; name: string }) {
  const { t, locale } = useI18n();
  const [pending, start] = useTransition();
  const submit = (q: number) =>
    start(async () => {
      const fd = new FormData();
      fd.set("itemId", itemId);
      fd.set("quantity", String(q));
      fd.set("locale", locale);
      await updateCartItemAction(fd);
    });
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 items-center border border-line" role="group" aria-label={`${t.product.quantity}: ${name}`} aria-busy={pending}>
        <button type="button" onClick={() => submit(quantity - 1)} disabled={pending || quantity <= 1} className="flex h-full w-9 items-center justify-center disabled:opacity-40" aria-label={t.cart.decrease}>
          <Minus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <output className="w-7 text-center text-sm tabular-nums" data-testid="line-qty">
          {quantity}
        </output>
        <button type="button" onClick={() => submit(quantity + 1)} disabled={pending || quantity >= max} className="flex h-full w-9 items-center justify-center disabled:opacity-40" aria-label={t.cart.increase} data-testid="line-increase">
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("itemId", itemId);
            await removeCartItemAction(fd);
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
        data-testid="line-remove"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        {t.cart.remove}
      </button>
    </div>
  );
}

export function CouponForm({ appliedCode, rejected }: { appliedCode: string | null; rejected: boolean }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(applyCouponAction, initialActionState);
  const [pending, start] = useTransition();

  if (appliedCode && !rejected) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          {t.cart.coupon}: <strong className="font-semibold tracking-wide">{appliedCode}</strong>
        </span>
        <button type="button" onClick={() => start(() => removeCouponAction())} disabled={pending} className="text-xs underline underline-offset-4">
          {t.cart.removeCoupon}
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="coupon" className="text-xs font-medium">
        {t.cart.coupon}
      </label>
      <div className="flex gap-2">
        <Input id="coupon" name="code" autoComplete="off" className="uppercase" maxLength={40} aria-describedby="coupon-msg" />
        <SubmitButton variant="outline">{t.cart.applyCoupon}</SubmitButton>
      </div>
      <p id="coupon-msg" className={state.ok ? "text-xs text-olive" : "text-xs text-danger"} role="status">
        {state.message ?? (rejected ? t.cart.couponInvalid : "")}
      </p>
    </form>
  );
}
