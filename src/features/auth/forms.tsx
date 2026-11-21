"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Checkbox } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "./actions";

function FormMessage({ ok, message }: { ok: boolean; message?: string }) {
  if (!message) return null;
  return <Alert tone={ok ? "success" : "danger"}>{message}</Alert>;
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(signInAction, initialActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {linkError ? <Alert tone="danger">{t.auth.linkInvalid}</Alert> : null}
      <FormMessage ok={state.ok} message={state.message} />
      <Field name="email" label={t.auth.email} error={state.errors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required inputMode="email" />}
      </Field>
      <Field name="password" label={t.auth.password} error={state.errors?.password}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" required />}
      </Field>
      <div className="flex justify-end">
        <Link href={localePath(locale, "/auth/forgot-password")} className="text-xs underline underline-offset-4 hover:text-forest">
          {t.auth.forgot}
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel={t.common.loading}>
        {t.auth.login}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link
          href={`${localePath(locale, "/auth/register")}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-ink underline underline-offset-4"
        >
          {t.auth.register}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(signUpAction, initialActionState);
  const kvkkHref = localePath(locale, "/pages/kvkk-aydinlatma-metni");
  const [before, after] = t.auth.kvkkNotice.split("{kvkk}");
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden className="hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
      <Field name="fullName" label={t.auth.fullName} error={state.errors?.fullName}>
        {(p) => <Input {...p} autoComplete="name" required maxLength={120} />}
      </Field>
      <Field name="email" label={t.auth.email} error={state.errors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required inputMode="email" />}
      </Field>
      <Field name="password" label={t.auth.password} error={state.errors?.password} hint={t.auth.passwordRules}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={10} maxLength={72} />}
      </Field>
      <Field name="passwordConfirm" label={t.auth.passwordConfirm} error={state.errors?.passwordConfirm}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </Field>
      <Checkbox id="f-marketingConsent" name="marketingConsent" label={t.auth.marketingConsent} />
      <p className="text-xs leading-relaxed text-muted">
        {before}
        <Link href={kvkkHref} className="underline underline-offset-2 hover:text-ink">
          {t.footer.kvkk}
        </Link>
        {after}
      </p>
      <SubmitButton className="w-full" pendingLabel={t.common.loading}>
        {t.auth.register}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href={localePath(locale, "/auth/login")} className="font-medium text-ink underline underline-offset-4">
          {t.auth.login}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage ok={state.ok} message={state.message} />
      <Field name="email" label={t.auth.email} error={state.errors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required inputMode="email" />}
      </Field>
      <SubmitButton className="w-full" pendingLabel={t.common.loading}>
        {t.auth.sendReset}
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href={localePath(locale, "/auth/login")} className="underline underline-offset-4">
          {t.auth.login}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(resetPasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage ok={state.ok} message={state.message} />
      <Field name="password" label={t.auth.password} error={state.errors?.password} hint={t.auth.passwordRules}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={10} maxLength={72} />}
      </Field>
      <Field name="passwordConfirm" label={t.auth.passwordConfirm} error={state.errors?.passwordConfirm}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full" pendingLabel={t.common.saving}>
        {t.auth.updatePassword}
      </SubmitButton>
    </form>
  );
}
