import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/feedback";
import { getDictionary } from "@/i18n";
import { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, type OrderStatus, type PaymentStatus } from "@/lib/orders/transitions";
import { cn } from "@/lib/utils";

const trDict = getDictionary("tr");

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-sm border border-line bg-paper", className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
          {title ? <h2 className="text-sm font-semibold tracking-wide">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-paper" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("border-b border-line bg-sand-50 px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-3 py-2.5 align-middle", className)} {...props} />;
}

export function EmptyRow({ colSpan, children = "Kayıt bulunamadı." }: { colSpan: number; children?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

/** GET-form based pagination: preserves the current query params. */
export function Pagination({ page, pageCount, total, basePath, params }: { page: number; pageCount: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pageCount <= 1) return <p className="mt-3 text-xs text-muted">{total} kayıt</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Sayfalama" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-xs text-muted">
        {total} kayıt · Sayfa {page} / {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="inline-flex h-9 items-center gap-1 rounded-sm border border-line px-3 hover:bg-sand-100">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Önceki
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={href(page + 1)} className="inline-flex h-9 items-center gap-1 rounded-sm border border-line px-3 hover:bg-sand-100">
            Sonraki <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONE[status]}>{trDict.order.statuses[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{trDict.order.paymentStatuses[status]}</Badge>;
}

export const ORDER_STATUS_LABELS = trDict.order.statuses;
export const PAYMENT_STATUS_LABELS = trDict.order.paymentStatuses;

export function PublishBadge({ status }: { status: "draft" | "published" | "archived" }) {
  const map = { draft: ["Taslak", "warning"], published: ["Yayında", "success"], archived: ["Arşiv", "neutral"] } as const;
  const [label, tone] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Aktif" : "Pasif"}</Badge>;
}

export function FilterBar({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-end gap-3 rounded-sm border border-line bg-paper p-3">
      {children}
      <button type="submit" className="h-11 rounded-sm bg-ink px-4 text-xs font-medium uppercase tracking-wide text-paper hover:bg-forest">
        Filtrele
      </button>
      <Link href={action} className="inline-flex h-11 items-center px-2 text-xs text-muted underline-offset-4 hover:underline">
        Temizle
      </Link>
    </form>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-[10rem] flex-col gap-1.5 text-xs font-medium", className)}>
      {label}
      {children}
    </label>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function sp(params: Record<string, string | string[] | undefined>, key: string): string {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}
