import "server-only";
import { createServiceClient } from "@/server/supabase/admin";
import { getClientIp } from "@/server/security";
import { getProviderById } from "./index";

export type RefundProcessResult = { status: "completed" | "manual_required" | "failed"; message?: string };

/**
 * Executes a pending refund with the payment provider (if its refund API is
 * integrated) and records the outcome via complete_refund(). Callers MUST
 * have already checked the 'orders.refund' permission — the refund row itself
 * can only be created by admin_cancel_order / admin_create_refund, which
 * enforce that permission in SQL.
 */
export async function processRefund(refundId: string, actorId: string): Promise<RefundProcessResult> {
  const db = createServiceClient();
  const { data: refund } = await db
    .from("refunds")
    .select("id, status, amount, payment_id, order_id, payments ( provider, provider_payment_id, currency )")
    .eq("id", refundId)
    .maybeSingle();
  if (!refund) return { status: "failed", message: "refund_not_found" };
  if (refund.status === "completed") return { status: "completed" };
  if (refund.status === "failed") return { status: "failed", message: "already_failed" };

  const payment = refund.payments;
  const provider = payment ? getProviderById(payment.provider) : null;
  if (!payment?.provider_payment_id || !provider?.refund || !provider.isAvailable()) {
    return { status: "manual_required", message: "Sağlayıcının iade API'si entegre değil; iadeyi sağlayıcı panelinden yapıp burada onaylayın." };
  }

  const res = await provider.refund({
    providerPaymentId: payment.provider_payment_id,
    amount: refund.amount,
    currency: payment.currency,
    refundId: refund.id,
    ip: await getClientIp(),
  });
  const { data, error } = await db.rpc("complete_refund", {
    p_refund_id: refund.id,
    p_success: res.ok,
    p_provider_refund_id: res.ok ? res.providerRefundId : (null as unknown as string),
    p_failure: res.ok ? (null as unknown as string) : res.error,
    p_actor: actorId,
  });
  if (error) return { status: "failed", message: error.message };
  return data === "completed" ? { status: "completed" } : { status: "failed", message: res.ok ? data : res.error };
}
