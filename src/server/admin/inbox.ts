"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/server/supabase/server";
import { authorize, dbFail, isUuid } from "./common";

export async function setMessageStatus(messageId: string, status: "new" | "read" | "archived"): Promise<ActionState> {
  const auth = await authorize("inbox.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(messageId) || !["new", "read", "archived"].includes(status)) return { ok: false, message: "Geçersiz istek." };
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").update({ status }).eq("id", messageId);
  if (error) return dbFail(error, "message status");
  revalidatePath("/admin/inbox", "layout");
  return { ok: true, message: status === "archived" ? "Arşivlendi." : status === "read" ? "Okundu olarak işaretlendi." : "Yeni olarak işaretlendi." };
}

export async function deleteMessage(messageId: string): Promise<ActionState> {
  const auth = await authorize("inbox.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(messageId)) return { ok: false, message: "Geçersiz istek." };
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").delete().eq("id", messageId);
  if (error) return dbFail(error, "message delete");
  revalidatePath("/admin/inbox", "layout");
  return { ok: true, message: "Mesaj silindi.", data: { redirect: "/admin/inbox" } };
}

export async function deleteSubscriber(subscriptionId: string): Promise<ActionState> {
  const auth = await authorize("newsletter.view");
  if (!auth.ok) return auth.state;
  if (!isUuid(subscriptionId)) return { ok: false, message: "Geçersiz istek." };
  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscriptions").delete().eq("id", subscriptionId);
  if (error) return dbFail(error, "subscriber delete");
  revalidatePath("/admin/newsletter");
  return { ok: true, message: "Abone kaydı silindi." };
}
