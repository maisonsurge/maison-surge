/**
 * Pure helpers for the admin panel (no server-only imports → unit-testable).
 */

/** Turkey has used a fixed UTC+03:00 offset since 2016 (no DST). */
const ISTANBUL_OFFSET = "+03:00";

/** "2026-12-01T10:30" (datetime-local, Istanbul wall time) → ISO string, or null. */
export function istanbulLocalToIso(value: string | null | undefined): string | null | "invalid" {
  if (!value || !value.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return "invalid";
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}${ISTANBUL_OFFSET}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in Istanbul wall time (for datetime-local inputs). */
export function isoToIstanbulLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** "10" or "10,5" (percent) → basis points (1000 / 1050). Empty → null. */
export function percentToBps(input: string): number | null | "invalid" {
  const s = input.trim().replace(",", ".");
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return "invalid";
  const [whole, frac = ""] = s.split(".");
  const bps = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return bps >= 0 && bps <= 10000 ? bps : "invalid";
}

export function bpsToPercent(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "";
  const whole = Math.trunc(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? String(whole) : `${whole},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

export type StockImportLine = { line: number; sku: string; stock: number } | { line: number; error: string; raw: string };

/** Parses "SKU,STOCK" lines (comma, semicolon or tab separated). Header lines are skipped. */
export function parseStockCsv(text: string): StockImportLine[] {
  const out: StockImportLine[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) {
      out.push({ line: i + 1, error: "İki sütun bekleniyor: sku,stok", raw: line });
      return;
    }
    const sku = (parts[0] ?? "").toUpperCase();
    const stockRaw = parts[1] ?? "";
    if (i === 0 && !/^\d+$/.test(stockRaw)) return; // header row
    if (!/^[A-Z0-9][A-Z0-9-]{1,47}$/.test(sku)) {
      out.push({ line: i + 1, error: "Geçersiz SKU", raw: line });
      return;
    }
    if (!/^\d{1,7}$/.test(stockRaw)) {
      out.push({ line: i + 1, error: "Stok 0 veya pozitif tam sayı olmalı", raw: line });
      return;
    }
    out.push({ line: i + 1, sku, stock: Number(stockRaw) });
  });
  return out;
}

/** RFC 4180 CSV cell escaping; also neutralises spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const CTA_HREF_RE = /^\/[A-Za-z0-9/_?=&%.-]*$/;
export const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,47}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COUPON_RE = /^[A-Z0-9_-]{3,40}$/;
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Moves item at index by dir (-1/+1); returns new array (no-op at bounds). */
export function moveItem<T>(items: readonly T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [it] = copy.splice(index, 1);
  copy.splice(target, 0, it as T);
  return copy;
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const p = Math.max(1, Math.trunc(page) || 1);
  return { from: (p - 1) * pageSize, to: p * pageSize - 1 };
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

/** Time window state of a coupon/campaign relative to `now` (server render time). */
export function windowState(startsAt: string | null, endsAt: string | null, now: number = Date.now()): "upcoming" | "active" | "expired" {
  if (endsAt !== null && Date.parse(endsAt) <= now) return "expired";
  if (startsAt !== null && Date.parse(startsAt) > now) return "upcoming";
  return "active";
}
