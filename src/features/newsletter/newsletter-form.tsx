"use client";

import { useActionState, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { subscribeNewsletterAction } from "./actions";

/**
 * Newsletter sign-up with explicit, unticked consent (İYS/KVKK: commercial
 * e-messages require prior consent). Honeypot + fill-time check against bots.
 */
export function NewsletterForm({ source = "footer", variant = "light" }: { source?: "footer" | "home"; variant?: "light" | "dark" }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(subscribeNewsletterAction, initialActionState);
  const [startedAt] = useState(() => Date.now());
  const uid = useId();
  const dark = variant === "dark";
  const emailId = `${uid}-email`;
  const consentId = `${uid}-consent`;

  if (state.ok) {
    return (
      <p role="status" className={cn("text-sm leading-relaxed", dark ? "text-paper" : "text-ink")}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="_ts" value={startedAt} />
      <div aria-hidden className="hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={emailId} className="sr-only">
          {t.newsletter.placeholder}
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t.newsletter.placeholder}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? `${emailId}-error` : undefined}
          className={cn(
            "h-11 w-full flex-1 rounded-sm border px-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-burgundy",
            dark ? "border-paper/40 bg-transparent text-paper placeholder:text-paper/70 focus:border-paper" : "border-line bg-paper text-ink placeholder:text-muted/80 focus:border-ink",
          )}
        />
        <SubmitButton variant={dark ? "outline" : "primary"} className={dark ? "border-paper text-paper hover:bg-paper hover:text-ink" : undefined} pendingLabel={t.common.loading}>
          {t.newsletter.submit}
        </SubmitButton>
      </div>
      <FieldError id={`${emailId}-error`} message={state.errors?.email} />
      <label htmlFor={consentId} className={cn("flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed", dark ? "text-paper/85" : "text-muted")}>
        <input
          id={consentId}
          name="consent"
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-olive)]"
          aria-invalid={Boolean(state.errors?.consent)}
          aria-describedby={state.errors?.consent ? `${consentId}-error` : undefined}
        />
        <span>{t.newsletter.consent}</span>
      </label>
      <FieldError id={`${consentId}-error`} message={state.errors?.consent} />
      {state.message ? (
        <p role="alert" className={cn("text-xs", dark ? "text-paper" : "text-danger")}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
