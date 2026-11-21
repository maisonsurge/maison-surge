import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { assertPermission, AuthorizationError, type SessionUser } from "@/server/auth";
import { dbErrorCode, fieldErrors, type ActionState } from "@/lib/action-state";
import { parseMoneyInput } from "@/lib/money";
import type { AppRole, Permission } from "@/lib/auth/permissions";

/** Turkish messages for stable error codes raised by our SQL functions / Postgres. */
const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Bu işlem için yetkiniz yok.",
  forbidden_refund: "Ödenmiş siparişi iptal etmek için iade yetkisi gerekir (yalnızca admin).",
  unauthenticated: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.",
  duplicate: "Bu değer zaten kullanılıyor (benzersiz olmalı).",
  in_use: "Bu kayıt başka kayıtlar tarafından kullanıldığı için silinemez. Arşivlemeyi veya pasif yapmayı deneyin.",
  check_violation: "Girilen değerlerden biri kurallara uymuyor.",
  invalid_transition: "Bu durum geçişine izin verilmiyor.",
  order_not_found: "Sipariş bulunamadı.",
  order_not_paid: "Sipariş ödenmemiş.",
  insufficient_stock: "Yeterli stok yok.",
  reason_required: "Gerekçe en az 3 karakter olmalı.",
  refund_amount_invalid: "İade tutarı geçersiz veya iade edilebilir tutarı aşıyor.",
  refund_not_found: "İade kaydı bulunamadı.",
  reference_required: "Referans en az 3 karakter olmalı.",
  below_reserved: "Stok, rezerve edilmiş adetin altına düşürülemez.",
  invalid_quantity: "Geçersiz adet.",
  variant_not_found: "Varyant bulunamadı.",
  product_not_found: "Ürün bulunamadı.",
  cannot_revoke_own_admin: "Kendi admin yetkinizi kaldıramazsınız.",
  stock_direct_update_forbidden: "Stok yalnızca stok güncelleme işlemiyle değiştirilebilir.",
  payment_status_direct_update_forbidden: "Ödeme durumu manuel olarak değiştirilemez.",
  unknown: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
};

export function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown!;
}

export function dbFail(error: { message?: string; code?: string } | null | undefined, context?: string): ActionState {
  const code = dbErrorCode(error);
  if (code === "unknown" && error) console.error(`[admin] ${context ?? "db"} failed`, { code: error.code, message: error.message });
  return { ok: false, message: errorMessage(code) };
}

export function zodFail(error: z.ZodError): ActionState {
  const errors = fieldErrors(error);
  // Nested paths like "name.tr" map to form field names "name_tr".
  for (const key of Object.keys(errors)) {
    if (!key.includes(".")) continue;
    errors[key.replace(/\./g, "_")] ??= errors[key]!;
    delete errors[key];
  }
  return { ok: false, message: "Lütfen işaretli alanları düzeltin.", errors };
}

export type Authorized = { ok: true; user: SessionUser; roles: AppRole[] } | { ok: false; state: ActionState };

/** First line of every admin server action. */
export async function authorize(permission: Permission): Promise<Authorized> {
  try {
    const { user, roles } = await assertPermission(permission);
    return { ok: true, user, roles };
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, state: { ok: false, message: errorMessage(err.message === "unauthenticated" ? "unauthenticated" : "forbidden") } };
    throw err;
  }
}

/** Storefront pages read catalog/content at request time; refresh their router caches. */
export function revalidateStorefront() {
  revalidatePath("/tr", "layout");
  revalidatePath("/en", "layout");
}

// ---------------------------------------------------------------------------
// FormData readers
// ---------------------------------------------------------------------------
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function strs(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Reads `${base}_tr` / `${base}_en` into a {tr,en} object without empty keys. */
export function localized(fd: FormData, base: string): { tr?: string; en?: string } {
  const out: { tr?: string; en?: string } = {};
  const tr = str(fd, `${base}_tr`);
  const en = str(fd, `${base}_en`);
  if (tr) out.tr = tr;
  if (en) out.en = en;
  return out;
}

/** Money input → kuruş. undefined = empty, null = invalid. */
export function moneyField(fd: FormData, key: string): number | undefined | null {
  const raw = str(fd, key);
  if (raw === "") return undefined;
  return parseMoneyInput(raw);
}

export function intField(fd: FormData, key: string): number | undefined | null {
  const raw = str(fd, key);
  if (raw === "") return undefined;
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Removes characters that have meaning inside PostgREST `or()` / `ilike` filters. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[^\p{L}\p{N}@._+\- ]/gu, "").trim().slice(0, 80);
}
