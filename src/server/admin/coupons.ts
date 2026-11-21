"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/server/supabase/server";
import { COUPON_RE, istanbulLocalToIso } from "@/features/admin/lib/helpers";
import { authorize, bool, dbFail, intField, isUuid, moneyField, optStr, str, zodFail } from "./common";

const INVALID = -1;

const couponSchema = z
  .object({
    code: z.string().regex(COUPON_RE, "Kod 3–40 karakter; büyük harf, rakam, _ veya -."),
    description: z.string().max(300).nullable(),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1, "Geçerli bir indirim değeri girin."),
    min_subtotal: z.number().int().min(0, "Geçerli bir tutar girin."),
    max_discount: z.number().int().min(1, "Geçerli bir tutar girin.").nullable(),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    usage_limit: z.number().int().min(1, "En az 1.").nullable(),
    per_customer_limit: z.number().int().min(1, "En az 1.").nullable(),
    is_active: z.boolean(),
  })
  .refine((v) => v.type !== "percent" || v.value <= 100, { path: ["value"], message: "Yüzde indirim 1–100 arasında olmalı." })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at > v.starts_at, { path: ["ends_at"], message: "Bitiş, başlangıçtan sonra olmalı." });

export async function saveCoupon(couponId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("coupons.manage");
  if (!auth.ok) return auth.state;
  if (couponId !== null && !isUuid(couponId)) return { ok: false, message: "Geçersiz kupon." };
  const type = str(fd, "type");
  // Percent values are plain integers; fixed values are money (kuruş).
  let value: number;
  if (type === "percent") {
    const n = intField(fd, "value");
    value = n === undefined || n === null ? INVALID : n;
  } else {
    const m = moneyField(fd, "value");
    value = m === undefined || m === null ? INVALID : m;
  }
  const money = (k: string) => {
    const m = moneyField(fd, k);
    return m === undefined ? null : m === null ? INVALID : m;
  };
  const int = (k: string) => {
    const n = intField(fd, k);
    return n === undefined ? null : n === null ? INVALID : n;
  };
  const starts = istanbulLocalToIso(str(fd, "starts_at"));
  const ends = istanbulLocalToIso(str(fd, "ends_at"));
  if (starts === "invalid" || ends === "invalid") return { ok: false, message: "Tarih biçimi geçersiz.", errors: { [starts === "invalid" ? "starts_at" : "ends_at"]: ["Geçersiz tarih."] } };

  const parsed = couponSchema.safeParse({
    code: str(fd, "code").toUpperCase(),
    description: optStr(fd, "description"),
    type,
    value,
    min_subtotal: money("min_subtotal") ?? 0,
    max_discount: money("max_discount"),
    starts_at: starts,
    ends_at: ends,
    usage_limit: int("usage_limit"),
    per_customer_limit: int("per_customer_limit"),
    is_active: bool(fd, "is_active"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { data, error } =
    couponId === null
      ? await supabase.from("coupons").insert(parsed.data).select("id").single()
      : await supabase.from("coupons").update(parsed.data).eq("id", couponId).select("id").single();
  if (error) return error.code === "23505" ? { ok: false, message: "Bu kupon kodu zaten var.", errors: { code: ["Kod kullanımda."] } } : dbFail(error, "coupon save");
  revalidatePath("/admin/coupons");
  if (couponId === null) redirect(`/admin/coupons/${data.id}?created=1`);
  return { ok: true, message: "Kupon kaydedildi." };
}

export async function deleteCoupon(couponId: string): Promise<ActionState> {
  const auth = await authorize("coupons.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(couponId)) return { ok: false, message: "Geçersiz kupon." };
  const supabase = await createClient();
  const { count } = await supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", couponId);
  if ((count ?? 0) > 0) return { ok: false, message: "Bu kupon siparişlerde kullanıldı; geçmişi korumak için silinemez. Pasif yapın." };
  const { error } = await supabase.from("coupons").delete().eq("id", couponId);
  if (error) return dbFail(error, "coupon delete");
  revalidatePath("/admin/coupons");
  return { ok: true, message: "Kupon silindi.", data: { redirect: "/admin/coupons" } };
}
