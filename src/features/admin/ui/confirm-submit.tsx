"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useFormCtx } from "./action-form";

/** Submit button that asks for confirmation before submitting its <form>. */
export function ConfirmSubmit({
  children,
  title,
  body,
  confirmLabel = "Onayla",
  variant = "danger",
  size = "md",
}: {
  children: ReactNode;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { pending } = useFormCtx();
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        aria-busy={pending}
        onClick={(e) => {
          formRef.current = e.currentTarget.form;
          setOpen(true);
        }}
      >
        {pending ? "İşleniyor…" : children}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
