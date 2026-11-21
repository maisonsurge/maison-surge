"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { initialActionState } from "@/lib/action-state";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfileAction } from "./actions";

export type ProfileValues = {
  email: string;
  full_name: string | null;
  phone: string | null;
  preferred_locale: "tr" | "en";
  marketing_consent: boolean;
};

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  return (
    <form action={action} className="grid max-w-xl gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field name="email" label={t.auth.email}>
        {(p) => <Input {...p} name={undefined} value={profile.email} readOnly disabled />}
      </Field>
      <Field name="full_name" label={t.auth.fullName} error={state.errors?.full_name}>
        {(p) => <Input {...p} defaultValue={profile.full_name ?? ""} autoComplete="name" maxLength={120} />}
      </Field>
      <Field name="phone" label={t.checkout.phone} error={state.errors?.phone}>
        {(p) => <Input {...p} type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" inputMode="tel" maxLength={20} />}
      </Field>
      <Field name="preferred_locale" label={t.account.language}>
        {(p) => (
          <Select {...p} defaultValue={profile.preferred_locale}>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </Select>
        )}
      </Field>
      <Checkbox id="f-marketing_consent" name="marketing_consent" defaultChecked={profile.marketing_consent} label={t.auth.marketingConsent} />
      <div>
        <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
      </div>
    </form>
  );
}
