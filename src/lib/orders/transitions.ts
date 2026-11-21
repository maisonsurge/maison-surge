import type { Enums } from "@/types/database.types";

export type OrderStatus = Enums<"order_status">;
export type PaymentStatus = Enums<"payment_status">;

/**
 * Admin-initiated transitions. Mirrors public.admin_update_order_status(),
 * admin_mark_shipped() and admin_cancel_order(); the database is authoritative.
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, { to: OrderStatus; via: "status" | "ship" | "cancel" }[]> = {
  pending_payment: [{ to: "cancelled", via: "cancel" }],
  confirmed: [
    { to: "processing", via: "status" },
    { to: "shipped", via: "ship" },
    { to: "cancelled", via: "cancel" },
  ],
  processing: [
    { to: "shipped", via: "ship" },
    { to: "cancelled", via: "cancel" },
  ],
  shipped: [{ to: "delivered", via: "status" }],
  delivered: [],
  cancelled: [],
  expired: [],
  on_hold: [
    { to: "confirmed", via: "status" },
    { to: "cancelled", via: "cancel" },
  ],
  refunded: [],
};

export function allowedAdminTransitions(status: OrderStatus) {
  return ADMIN_TRANSITIONS[status] ?? [];
}

export function canRefund(status: OrderStatus, payment: PaymentStatus) {
  return (
    (payment === "paid" || payment === "partially_refunded") &&
    ["confirmed", "processing", "shipped", "delivered", "on_hold"].includes(status)
  );
}

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending_payment: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
  expired: "neutral",
  on_hold: "danger",
  refunded: "neutral",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  unpaid: "neutral",
  pending: "warning",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
};
