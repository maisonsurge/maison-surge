"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import type { OrderStatus } from "@/lib/orders/transitions";
import { createClient } from "@/server/supabase/server";
import { processRefund } from "@/server/payments/refunds";
import { authorize, bool, dbFail, isUuid, moneyField, str, zodFail } from "./common";

function revalidateOrder(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

async function refundOutcome(refundId: string, actorId: string, prefix: string): Promise<ActionState> {
  try {
    const r = await processRefund(refundId, actorId);
    if (r.status === "completed") return { ok: true, message: `${prefix} İade sağlayıcı üzerinden tamamlandı.` };
    if (r.status === "manual_required") {
      return {
        ok: true,
        message: `${prefix} İade kaydı oluşturuldu; ödeme sağlayıcısı otomatik iadeyi desteklemiyor. İadeyi sağlayıcı panelinden yapıp aşağıdan “Manuel iade onayı” ile kapatın.${r.message ? ` (${r.message})` : ""}`,
      };
    }
    return { ok: false, message: `${prefix} Ancak sağlayıcı iadesi başarısız oldu: ${r.message ?? "bilinmeyen hata"}. İade kaydı “başarısız” durumda.` };
  } catch (err) {
    console.error("[admin] processRefund threw", err instanceof Error ? err.message : err);
    return { ok: false, message: `${prefix} Sağlayıcı iadesi çalıştırılamadı; iade kaydı beklemede kaldı. “İadeyi tekrar dene” veya manuel onay kullanın.` };
  }
}

const STATUS_TARGETS = ["processing", "delivered", "confirmed"] as const;

export async function updateOrderStatus(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("orders.manage");
  if (!auth.ok) return auth.state;
  const to = str(fd, "to");
  if (!isUuid(orderId) || !(STATUS_TARGETS as readonly string[]).includes(to)) return { ok: false, message: "Geçersiz durum." };
  const note = str(fd, "note").slice(0, 500) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_order_status", { p_order_id: orderId, p_to: to as OrderStatus, p_note: note ?? undefined });
  if (error) return dbFail(error, "order status");
  revalidateOrder(orderId);
  return { ok: true, message: "Sipariş durumu güncellendi." };
}

const shipSchema = z.object({
  carrier: z.string().min(2, "Kargo firması en az 2 karakter.").max(60),
  tracking_number: z.string().min(3, "Takip numarası en az 3 karakter.").max(80),
  tracking_url: z
    .string()
    .max(500, "Bağlantı en fazla 500 karakter.")
    .refine((v) => v === "" || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v), "Takip bağlantısı https:// ile başlamalı."),
});

export async function markOrderShipped(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("orders.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(orderId)) return { ok: false, message: "Geçersiz sipariş." };
  const parsed = shipSchema.safeParse({ carrier: str(fd, "carrier"), tracking_number: str(fd, "tracking_number"), tracking_url: str(fd, "tracking_url") });
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_shipped", {
    p_order_id: orderId,
    p_carrier: parsed.data.carrier,
    p_tracking_number: parsed.data.tracking_number,
    p_tracking_url: parsed.data.tracking_url || undefined,
  });
  if (error) return dbFail(error, "mark shipped");
  revalidateOrder(orderId);
  return { ok: true, message: "Sipariş kargoya verildi olarak işaretlendi." };
}

export async function cancelOrder(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("orders.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(orderId)) return { ok: false, message: "Geçersiz sipariş." };
  const reason = str(fd, "reason");
  if (reason.length < 3 || reason.length > 500) return { ok: false, message: "İptal gerekçesi 3–500 karakter olmalı.", errors: { reason: ["Gerekçe en az 3 karakter."] } };
  const supabase = await createClient();
  const { data: refundId, error } = await supabase.rpc("admin_cancel_order", { p_order_id: orderId, p_reason: reason, p_restock: bool(fd, "restock") });
  if (error) return dbFail(error, "cancel order");
  revalidateOrder(orderId);
  if (refundId) {
    const res = await refundOutcome(refundId, auth.user.id, "Sipariş iptal edildi.");
    revalidateOrder(orderId);
    return res;
  }
  return { ok: true, message: "Sipariş iptal edildi; rezerve stok serbest bırakıldı." };
}

export async function createRefund(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("orders.refund");
  if (!auth.ok) return auth.state;
  if (!isUuid(orderId)) return { ok: false, message: "Geçersiz sipariş." };
  const amount = moneyField(fd, "amount");
  const reason = str(fd, "reason");
  const errors: Record<string, string[]> = {};
  if (!amount || amount <= 0) errors.amount = ["Geçerli bir iade tutarı girin."];
  if (reason.length < 3 || reason.length > 500) errors.reason = ["Gerekçe 3–500 karakter olmalı."];
  if (Object.keys(errors).length) return { ok: false, message: "Lütfen işaretli alanları düzeltin.", errors };
  const supabase = await createClient();
  const { data: refundId, error } = await supabase.rpc("admin_create_refund", { p_order_id: orderId, p_amount: amount!, p_reason: reason, p_restock: bool(fd, "restock") });
  if (error || !refundId) return dbFail(error, "create refund");
  const res = await refundOutcome(refundId, auth.user.id, "İade talebi oluşturuldu.");
  revalidateOrder(orderId);
  return res;
}

export async function retryRefund(orderId: string, refundId: string): Promise<ActionState> {
  const auth = await authorize("orders.refund");
  if (!auth.ok) return auth.state;
  if (!isUuid(orderId) || !isUuid(refundId)) return { ok: false, message: "Geçersiz kayıt." };
  const res = await refundOutcome(refundId, auth.user.id, "");
  revalidateOrder(orderId);
  return { ...res, message: res.message?.trim() };
}

export async function markRefundManual(orderId: string, refundId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("orders.refund");
  if (!auth.ok) return auth.state;
  if (!isUuid(orderId) || !isUuid(refundId)) return { ok: false, message: "Geçersiz kayıt." };
  const reference = str(fd, "reference");
  if (reference.length < 3 || reference.length > 200) return { ok: false, message: "Sağlayıcı iade referansı 3–200 karakter olmalı.", errors: { reference: ["Referans en az 3 karakter."] } };
  if (!bool(fd, "confirm")) return { ok: false, message: "İadenin sağlayıcı panelinde yapıldığını onaylayın.", errors: { confirm: ["Onay gerekli."] } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_mark_refund_manual", { p_refund_id: refundId, p_reference: reference });
  if (error) return dbFail(error, "manual refund");
  revalidateOrder(orderId);
  if (data !== "completed") return { ok: false, message: `İade zaten işlenmiş (${data}).` };
  return { ok: true, message: "İade tamamlandı olarak kaydedildi." };
}

export async function saveInternalNote(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize("orders.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(orderId)) return { ok: false, message: "Geçersiz sipariş." };
  const note = str(fd, "internal_note");
  if (note.length > 2000) return { ok: false, message: "Not en fazla 2000 karakter.", errors: { internal_note: ["En fazla 2000 karakter."] } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_internal_note", { p_order_id: orderId, p_note: note });
  if (error) return dbFail(error, "internal note");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "İç not kaydedildi." };
}
