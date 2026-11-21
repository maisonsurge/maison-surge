import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-sand-100 text-ink border-line",
  success: "bg-olive text-paper border-olive",
  warning: "bg-sand-50 text-warning border-warning/40",
  danger: "bg-burgundy text-paper border-burgundy",
  info: "bg-forest text-paper border-forest",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const alertTones: Record<Tone, string> = {
  neutral: "border-line bg-sand-50 text-ink",
  success: "border-olive/50 bg-sand-50 text-ink",
  warning: "border-warning/50 bg-sand-50 text-ink",
  danger: "border-danger/60 bg-sand-50 text-ink",
  info: "border-forest/40 bg-sand-50 text-ink",
};

const alertAccent: Record<Tone, string> = {
  neutral: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function Alert({
  tone = "neutral",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cn("relative overflow-hidden rounded-sm border py-3 pr-4 pl-5 text-sm", alertTones[tone], className)}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", alertAccent[tone])} />
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title ? "mt-1" : "", "leading-relaxed")}>{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-sand-100", className)} />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export function EmptyState({ title, body, action, className }: { title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-16 text-center", className)}>
      <p className="font-display text-2xl">{title}</p>
      {body ? <p className="max-w-md text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
