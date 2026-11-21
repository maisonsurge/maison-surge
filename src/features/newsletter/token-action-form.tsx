"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";

/** Shared confirm/unsubscribe form: explicit button press (POST) consumes the token. */
export function TokenActionForm({
  token,
  label,
  action: serverAction,
}: {
  token: string;
  label: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(serverAction, initialActionState);
  if (state.message) return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" pendingLabel={t.common.loading}>
        {label}
      </SubmitButton>
    </form>
  );
}
