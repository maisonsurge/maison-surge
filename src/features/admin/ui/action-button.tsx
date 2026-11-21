"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";

/**
 * Runs a (bound) Server Action on click, optionally behind a confirmation
 * dialog. Shows the result as a toast; follows `data.redirect` if returned.
 */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  successMessage,
  className,
  ariaLabel,
  disabled,
}: {
  action: () => Promise<ActionState | void>;
  children: ReactNode;
  confirm?: { title: string; body?: ReactNode; confirmLabel?: string };
  variant?: Variant;
  size?: "sm" | "md" | "icon";
  successMessage?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const run = () =>
    start(async () => {
      const res = await action();
      setOpen(false);
      if (!res) return;
      if (res.ok) {
        if (successMessage || res.message) toast(res.message ?? successMessage ?? "Tamam", "success");
        const redirectTo = (res.data as { redirect?: string } | undefined)?.redirect;
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast(res.message ?? "İşlem başarısız.", "error");
      }
    });

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        aria-label={ariaLabel}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {children}
      </Button>
      {confirm ? (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={run}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={pending ? "İşleniyor…" : (confirm.confirmLabel ?? "Onayla")}
          pending={pending}
        />
      ) : null}
    </>
  );
}
