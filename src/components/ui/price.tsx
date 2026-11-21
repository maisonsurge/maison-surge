import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  amount,
  compareAt,
  locale,
  className,
}: {
  amount: number;
  compareAt?: number | null;
  locale: string;
  className?: string;
}) {
  const onSale = typeof compareAt === "number" && compareAt > amount;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 font-sans tabular-nums", className)}>
      <span className={onSale ? "text-burgundy" : undefined}>{formatMoney(amount, locale)}</span>
      {onSale ? (
        <s className="text-[0.85em] text-muted" aria-label={locale === "en" ? `Was ${formatMoney(compareAt, locale)}` : `Önceki fiyat ${formatMoney(compareAt, locale)}`}>
          {formatMoney(compareAt, locale)}
        </s>
      ) : null}
    </span>
  );
}
