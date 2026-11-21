/**
 * Money is stored and computed as integer minor units (kuruş). Never use
 * floating point for arithmetic; conversion to a decimal string happens only
 * for display or when a payment provider API requires it.
 */
export type Kurus = number;

export function assertKurus(value: number): Kurus {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid money amount: ${value}`);
  return value;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: Kurus, locale: string = "tr", currency = "TRY"): string {
  const key = `${locale}-${currency}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale === "en" ? "en-GB" : "tr-TR", { style: "currency", currency, minimumFractionDigits: 2 });
    formatters.set(key, f);
  }
  return f.format(amount / 100);
}

/** "1234.50" style string for provider APIs, computed with integer math. */
export function toDecimalString(amount: Kurus): string {
  assertKurus(amount);
  const lira = Math.trunc(amount / 100);
  const kurus = amount % 100;
  return `${lira}.${kurus.toString().padStart(2, "0")}`;
}

/** Parses a user-entered TRY amount ("1.299,90", "1299.9", "1299") into kuruş. */
export function parseMoneyInput(input: string): Kurus | null {
  const s = input.trim().replace(/\s|₺|TL/gi, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",") && s.includes(".")) {
    normalized = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    normalized = s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, "");
  }
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!m) return null;
  const lira = Number(m[1]);
  const frac = (m[2] ?? "").padEnd(2, "0");
  return lira * 100 + Number(frac);
}

/** Kuruş → "1299,90" for editable admin inputs. */
export function toInputValue(amount: Kurus | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return toDecimalString(amount).replace(".", ",");
}
