"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal built on the native <dialog> element: showModal() gives a real focus
 * trap, inert background, Escape-to-close and returns focus on close.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = () => onClose();
    el.addEventListener("close", handle);
    return () => el.removeEventListener("close", handle);
  }, [onClose]);
  return ref;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel = "Kapat",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  className?: string;
}) {
  const ref = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-sm border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/50 open:animate-fade-in",
        className,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dialog-title" className="font-display text-xl">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-m-2 p-2 text-muted hover:text-ink">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  closeLabel = "Kapat",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  side?: "left" | "right";
  closeLabel?: string;
}) {
  const ref = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      className={cn(
        "fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(420px,100%)] max-w-none border-line bg-paper p-0 text-ink backdrop:bg-ink/40",
        side === "right" ? "right-0 left-auto border-l open:animate-slide-in-right" : "left-0 border-r open:animate-slide-in-left",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="drawer-title" className="eyebrow">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-m-2 p-2 text-muted hover:text-ink">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = "Vazgeç",
  pending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {body ? <p className="text-sm leading-relaxed text-muted">{body}</p> : null}
      {children}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="h-10 px-4 text-xs font-medium uppercase tracking-wide hover:bg-sand-100">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="h-10 rounded-sm bg-burgundy px-4 text-xs font-medium uppercase tracking-wide text-paper hover:bg-burgundy-dark disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
