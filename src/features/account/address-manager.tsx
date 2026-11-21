"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from "./actions";

export type AddressRecord = {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  district: string;
  city: string;
  postal_code: string | null;
  is_default: boolean;
};

function AddressForm({ address, onDone }: { address: AddressRecord | null; onDone: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [state, action] = useActionState<ActionState, FormData>(saveAddressAction, initialActionState);

  useEffect(() => {
    if (state.ok) {
      if (state.message) toast(state.message, "success");
      onDone();
    }
  }, [state, toast, onDone]);

  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      {!state.ok && state.message ? (
        <Alert tone="danger" className="sm:col-span-2">
          {state.message}
        </Alert>
      ) : null}
      <Field name="label" label={`${t.account.label} — ${t.common.optional}`} error={e.label} className="sm:col-span-2">
        {(p) => <Input {...p} defaultValue={address?.label ?? ""} maxLength={40} />}
      </Field>
      <Field name="full_name" label={t.checkout.fullName} error={e.full_name}>
        {(p) => <Input {...p} defaultValue={address?.full_name ?? ""} autoComplete="name" required />}
      </Field>
      <Field name="phone" label={t.checkout.phone} error={e.phone}>
        {(p) => <Input {...p} type="tel" defaultValue={address?.phone ?? ""} autoComplete="tel" inputMode="tel" required />}
      </Field>
      <Field name="line1" label={t.checkout.line1} error={e.line1} className="sm:col-span-2">
        {(p) => <Input {...p} defaultValue={address?.line1 ?? ""} autoComplete="address-line1" required />}
      </Field>
      <Field name="line2" label={`${t.checkout.line2} — ${t.common.optional}`} error={e.line2} className="sm:col-span-2">
        {(p) => <Input {...p} defaultValue={address?.line2 ?? ""} autoComplete="address-line2" />}
      </Field>
      <Field name="district" label={t.checkout.district} error={e.district}>
        {(p) => <Input {...p} defaultValue={address?.district ?? ""} autoComplete="address-level2" required />}
      </Field>
      <Field name="city" label={t.checkout.city} error={e.city}>
        {(p) => <Input {...p} defaultValue={address?.city ?? ""} autoComplete="address-level1" required />}
      </Field>
      <Field name="postal_code" label={`${t.checkout.postalCode} — ${t.common.optional}`} error={e.postal_code}>
        {(p) => <Input {...p} defaultValue={address?.postal_code ?? ""} autoComplete="postal-code" inputMode="numeric" maxLength={5} />}
      </Field>
      <div className="flex items-end pb-2">
        <Checkbox id="f-is_default" name="is_default" defaultChecked={address?.is_default ?? false} label={t.account.defaultAddress} />
      </div>
      <div className="flex justify-end gap-3 sm:col-span-2">
        <Button variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}

export function AddressManager({ addresses }: { addresses: AddressRecord[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [editing, setEditing] = useState<AddressRecord | null | "new">(null);
  const [deleting, setDeleting] = useState<AddressRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const close = useCallback(() => setEditing(null), []);

  const run = (fn: () => Promise<ActionState>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.message) toast(res.message, res.ok ? "success" : "error");
      after?.();
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setEditing("new")}>
          {t.account.addAddress}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState title={t.account.noAddresses} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col justify-between gap-4 border border-line p-5">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {a.label ? <span className="font-medium">{a.label}</span> : null}
                  {a.is_default ? <Badge tone="success">{t.account.defaultAddress}</Badge> : null}
                </div>
                <address className="text-sm not-italic leading-relaxed">
                  <span className="block">{a.full_name}</span>
                  <span className="block">{a.line1}</span>
                  {a.line2 ? <span className="block">{a.line2}</span> : null}
                  <span className="block">{[a.postal_code, a.district, a.city].filter(Boolean).join(" ")}</span>
                  <span className="block text-muted">{a.phone}</span>
                </address>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <button type="button" className="underline underline-offset-4 hover:text-forest" onClick={() => setEditing(a)}>
                  {t.common.edit}
                </button>
                {!a.is_default ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="underline underline-offset-4 hover:text-forest disabled:opacity-50"
                    onClick={() => run(() => setDefaultAddressAction(a.id, locale))}
                  >
                    {t.account.makeDefault}
                  </button>
                ) : null}
                <button type="button" className="text-burgundy underline underline-offset-4" onClick={() => setDeleting(a)}>
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={close}
        title={editing === "new" ? t.account.addAddress : t.account.editAddress}
        closeLabel={t.common.close}
        className="max-w-2xl"
      >
        {editing !== null ? <AddressForm key={editing === "new" ? "new" : editing.id} address={editing === "new" ? null : editing} onDone={close} /> : null}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.account.deleteAddress}
        body={t.account.deleteAddressConfirm}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        pending={pending}
        onConfirm={() => {
          const target = deleting;
          if (target) run(() => deleteAddressAction(target.id, locale), () => setDeleting(null));
        }}
      />
    </div>
  );
}
