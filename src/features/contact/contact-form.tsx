"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/i18n/client";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendContactMessageAction } from "./actions";

export function ContactForm({ defaultEmail, defaultName }: { defaultEmail?: string; defaultName?: string }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(sendContactMessageAction, initialActionState);
  const [startedAt] = useState(() => Date.now());

  if (state.ok) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="_ts" value={startedAt} />
      <div aria-hidden className="hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.message ? (
        <Alert tone="danger" className="sm:col-span-2">
          {state.message}
        </Alert>
      ) : null}
      <Field name="name" label={t.contact.name} error={e.name}>
        {(p) => <Input {...p} defaultValue={defaultName} autoComplete="name" required maxLength={120} />}
      </Field>
      <Field name="email" label={t.contact.email} error={e.email}>
        {(p) => <Input {...p} type="email" defaultValue={defaultEmail} autoComplete="email" inputMode="email" required />}
      </Field>
      <Field name="subject" label={t.contact.subject} error={e.subject}>
        {(p) => <Input {...p} required maxLength={160} />}
      </Field>
      <Field name="order_number" label={t.contact.orderNumber} error={e.order_number}>
        {(p) => <Input {...p} maxLength={40} />}
      </Field>
      <Field name="message" label={t.contact.message} error={e.message} className="sm:col-span-2">
        {(p) => <Textarea {...p} required rows={6} minLength={10} maxLength={5000} />}
      </Field>
      <p className="text-xs text-muted sm:col-span-2">{t.contact.privacy}</p>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel={t.common.loading}>{t.contact.send}</SubmitButton>
      </div>
    </form>
  );
}
