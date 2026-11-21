"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/server/supabase/server";
import { percentToBps, SLUG_RE } from "@/features/admin/lib/helpers";
import { authorize, bool, dbFail, intField, isUuid, localized, moneyField, optStr, revalidateStorefront, str, zodFail } from "./common";

const COMPANY_KEYS = ["legal_name", "address", "mersis_no", "tax_office", "tax_number", "kep_address", "trade_registry_no"] as const;
const SOCIAL_KEYS = ["instagram", "x", "tiktok", "youtube"] as const;
const httpsUrl = z.string().max(300).regex(/^https:\/\/[^\s]+$/, "Bağlantı https:// ile başlamalı.");

const settingsSchema = z.object({
  store_name: z.string().min(2, "Mağaza adı zorunludur.").max(80),
  support_email: z.email("Geçerli bir e-posta girin.").max(254).nullable(),
  support_phone: z.string().regex(/^\+?[0-9 ()-]{7,20}$/, "Geçerli bir telefon girin.").nullable(),
  announcement: z.object({ tr: z.string().max(200).optional(), en: z.string().max(200).optional() }),
  announcement_enabled: z.boolean(),
  vat_rate_bps: z.number().int().min(0).max(10000).nullable(),
  reservation_minutes: z.number().int().min(5, "En az 5 dakika.").max(240, "En fazla 240 dakika."),
  low_stock_threshold: z.number().int().min(0).max(100000),
  terms_version: z.string().min(1, "Sözleşme sürümü zorunludur.").max(40),
  company_info: z.record(z.string(), z.string().max(500)),
  social_links: z.record(z.string(), httpsUrl),
});

export async function saveSiteSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return auth.state;
  const vat = percentToBps(str(fd, "vat_percent"));
  if (vat === "invalid") return { ok: false, message: "KDV oranı 0–100 arasında olmalı.", errors: { vat_percent: ["Geçersiz oran (örn. 10 veya 20)."] } };
  const int = (k: string, fallback: number) => {
    const n = intField(fd, k);
    return n === undefined ? fallback : n === null ? -1 : n;
  };
  const company: Record<string, string> = {};
  for (const k of COMPANY_KEYS) {
    const v = str(fd, `company_${k}`);
    if (v) company[k] = v;
  }
  const social: Record<string, string> = {};
  for (const k of SOCIAL_KEYS) {
    const v = str(fd, `social_${k}`);
    if (v) social[k] = v;
  }
  const parsed = settingsSchema.safeParse({
    store_name: str(fd, "store_name"),
    support_email: optStr(fd, "support_email"),
    support_phone: optStr(fd, "support_phone"),
    announcement: localized(fd, "announcement"),
    announcement_enabled: bool(fd, "announcement_enabled"),
    vat_rate_bps: vat,
    reservation_minutes: int("reservation_minutes", 30),
    low_stock_threshold: int("low_stock_threshold", 3),
    terms_version: str(fd, "terms_version"),
    company_info: company,
    social_links: social,
  });
  if (!parsed.success) {
    const res = zodFail(parsed.error);
    // social_links.instagram → social_instagram
    for (const key of Object.keys(res.errors ?? {})) {
      const m = /^social_links_(\w+)$/.exec(key);
      if (m && res.errors) res.errors[`social_${m[1]}`] = res.errors[key];
    }
    return res;
  }
  if (parsed.data.announcement_enabled && !parsed.data.announcement.tr) return { ok: false, message: "Duyuru açıkken Türkçe duyuru metni zorunludur.", errors: { announcement_tr: ["Metin girin."] } };
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").update(parsed.data).eq("id", true);
  if (error) return dbFail(error, "settings save");
  revalidatePath("/admin/settings");
  revalidateStorefront();
  return { ok: true, message: "Ayarlar kaydedildi." };
}

const shippingSchema = z.object({
  code: z.string().regex(SLUG_RE, "Kod küçük harf, rakam ve tire içermeli.").max(40),
  name: z.object({ tr: z.string().min(1, "Türkçe ad zorunludur.").max(80), en: z.string().max(80).optional() }),
  description: z.object({ tr: z.string().max(300).optional(), en: z.string().max(300).optional() }),
  price: z.number().int().min(0, "Geçerli bir ücret girin."),
  free_over: z.number().int().min(1, "Geçerli bir tutar girin.").nullable(),
  is_active: z.boolean(),
  position: z.number().int().min(0).max(100000),
});

export async function saveShippingMethod(methodId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return auth.state;
  if (methodId !== null && !isUuid(methodId)) return { ok: false, message: "Geçersiz yöntem." };
  const price = moneyField(fd, "price");
  const freeOver = moneyField(fd, "free_over");
  const pos = intField(fd, "position");
  const name = localized(fd, "name");
  const parsed = shippingSchema.safeParse({
    code: str(fd, "code").toLowerCase(),
    name: { tr: name.tr ?? "", en: name.en },
    description: localized(fd, "description"),
    price: price === undefined || price === null ? -1 : price,
    free_over: freeOver === undefined ? null : freeOver === null ? -1 : freeOver,
    is_active: bool(fd, "is_active"),
    position: pos === undefined ? 0 : pos === null ? -1 : pos,
  });
  if (!parsed.success) return zodFail(parsed.error);
  const row = { ...parsed.data, name: Object.fromEntries(Object.entries(parsed.data.name).filter(([, v]) => v)) };
  const supabase = await createClient();
  const { error } = methodId === null ? await supabase.from("shipping_methods").insert(row) : await supabase.from("shipping_methods").update(row).eq("id", methodId);
  if (error) return error.code === "23505" ? { ok: false, message: "Bu kod zaten kullanılıyor.", errors: { code: ["Kod kullanımda."] } } : dbFail(error, "shipping save");
  revalidatePath("/admin/settings");
  revalidateStorefront();
  return { ok: true, message: "Teslimat yöntemi kaydedildi." };
}

export async function deleteShippingMethod(methodId: string): Promise<ActionState> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(methodId)) return { ok: false, message: "Geçersiz yöntem." };
  const supabase = await createClient();
  const { error } = await supabase.from("shipping_methods").delete().eq("id", methodId);
  if (error) return dbFail(error, "shipping delete");
  revalidatePath("/admin/settings");
  revalidateStorefront();
  return { ok: true, message: "Teslimat yöntemi silindi. Geçmiş siparişlerdeki kargo adı korunur." };
}

/** Removes seeded demo products (is_demo). Products that cannot be deleted (open reservations) are archived. */
export async function deleteDemoData(): Promise<ActionState> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return auth.state;
  const catalog = await authorize("catalog.manage");
  if (!catalog.ok) return catalog.state;
  const supabase = await createClient();
  const { data: demo, error } = await supabase.from("products").select("id").eq("is_demo", true);
  if (error) return dbFail(error, "demo list");
  let deleted = 0;
  let archived = 0;
  for (const p of demo ?? []) {
    const del = await supabase.from("products").delete().eq("id", p.id);
    if (!del.error) {
      deleted++;
      continue;
    }
    const arc = await supabase.from("products").update({ status: "archived", is_featured: false }).eq("id", p.id);
    if (!arc.error) archived++;
  }
  revalidatePath("/admin", "layout");
  revalidateStorefront();
  if ((demo ?? []).length === 0) return { ok: true, message: "Silinecek demo ürün yok." };
  return { ok: true, message: `${deleted} demo ürün silindi${archived ? `, ${archived} ürün bağlı kayıtları olduğu için arşivlendi` : ""}.` };
}
