import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-sm border border-line bg-paper px-3 text-sm text-ink placeholder:text-muted/80 transition-colors focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-burgundy disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-xs font-medium tracking-wide text-ink", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%231a1a1a' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, label, id, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 text-sm leading-relaxed", className)}>
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-olive)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | string[] | null }) {
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-danger" role="alert">
      {text}
    </p>
  );
}

/** Label + control + error, wired with aria attributes. */
export function Field({
  name,
  label,
  error,
  hint,
  children,
  className,
}: {
  name: string;
  label: ReactNode;
  error?: string | string[] | null;
  hint?: ReactNode;
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = `f-${name}`;
  const errId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, name, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={errId} message={error} />
    </div>
  );
}
