"use server";

import { createServiceClient } from "@/server/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { looksLikeBot, rateLimitByIp } from "@/server/security";
import { asLocale, getDictionary } from "@/i18n";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { makeContactSchema } from "./schema";

export async function sendContactMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary(asLocale(formData.get("locale")));
  const parsed = makeContactSchema(t).safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    order_number: String(formData.get("order_number") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  // Bots get the same success response but nothing is stored.
  if (looksLikeBot(formData)) return { ok: true, message: t.contact.sent };
  if (!(await rateLimitByIp("contact", 3, 600))) return { ok: false, message: t.common.rateLimited };

  const user = await getSessionUser();
  const db = createServiceClient();
  const { error } = await db.from("contact_messages").insert({ ...parsed.data, user_id: user?.id ?? null });
  if (error) {
    console.error("[contact] insert failed", error.code);
    return { ok: false, message: t.common.error };
  }
  return { ok: true, message: t.contact.sent };
}
