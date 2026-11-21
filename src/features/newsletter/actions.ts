"use server";

import { z } from "zod";
import { createServiceClient } from "@/server/supabase/admin";
import { looksLikeBot, randomToken, rateLimitByIp, sha256Hex } from "@/server/security";
import { emailLayout, escapeHtml, isEmailConfigured, sendEmail } from "@/server/email";
import { asLocale, getDictionary, localePath } from "@/i18n";
import { publicEnv } from "@/lib/env";
import { fieldErrors, type ActionState } from "@/lib/action-state";

const NEWSLETTER_CONSENT_VERSION = "newsletter-v1";
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sourceSchema = z.enum(["footer", "home", "account"]).catch("footer");

export async function subscribeNewsletterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = asLocale(formData.get("locale"));
  const t = getDictionary(locale);
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: t.validation.email })),
      consent: z.literal(true, { message: t.newsletter.consentRequired }),
    })
    .safeParse({ email: String(formData.get("email") ?? ""), consent: formData.get("consent") === "on" });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  if (looksLikeBot(formData)) return { ok: true, message: t.newsletter.success };
  if (!(await rateLimitByIp("newsletter", 5, 600))) return { ok: false, message: t.common.rateLimited };

  const db = createServiceClient();
  const email = parsed.data.email;
  const source = sourceSchema.parse(formData.get("source"));
  const { data: existing } = await db.from("newsletter_subscriptions").select("id, status").eq("email", email).maybeSingle();
  if (existing?.status === "confirmed") return { ok: true, message: t.newsletter.success };

  const token = randomToken(32);
  const values = {
    email,
    status: "pending" as const,
    locale,
    source,
    consent_text_version: NEWSLETTER_CONSENT_VERSION,
    consent_at: new Date().toISOString(),
    confirm_token_hash: sha256Hex(token),
    unsubscribed_at: null,
  };
  const { error } = existing
    ? await db.from("newsletter_subscriptions").update(values).eq("id", existing.id)
    : await db.from("newsletter_subscriptions").insert(values);
  if (error && error.code !== "23505") {
    console.error("[newsletter] upsert failed", error.code);
    return { ok: false, message: t.common.error };
  }

  if (!isEmailConfigured()) {
    // Double opt-in needs an e-mail provider; the record stays "pending".
    return { ok: true, message: t.newsletter.success };
  }
  const confirmUrl = `${publicEnv.siteUrl}${localePath(locale, "/newsletter/confirm")}?token=${encodeURIComponent(token)}`;
  const unsubscribeUrl = `${publicEnv.siteUrl}${localePath(locale, "/newsletter/unsubscribe")}?token=${encodeURIComponent(token)}`;
  const result = await sendEmail({
    to: email,
    subject: `${t.newsletter.confirmTitle} — MAISON SURGE`,
    html: emailLayout(
      t.newsletter.confirmTitle,
      `<p style="font-size:14px;line-height:1.6">${escapeHtml(t.newsletter.consent)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#1A1A1A;color:#FBFAF7;text-decoration:none;padding:12px 22px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase">${escapeHtml(
        t.newsletter.confirmCta,
      )}</a></p>
<p style="font-size:12px;color:#5F5B53"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#5F5B53">${escapeHtml(t.newsletter.unsubscribeCta)}</a></p>`,
    ),
    text: `${t.newsletter.confirmTitle}\n\n${t.newsletter.consent}\n\n${t.newsletter.confirmCta}: ${confirmUrl}\n${t.newsletter.unsubscribeCta}: ${unsubscribeUrl}`,
  });
  return { ok: true, message: result.sent ? t.newsletter.pendingConfirm : t.newsletter.success };
}

async function findByToken(token: string) {
  if (!token || token.length < 32 || token.length > 100) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("newsletter_subscriptions")
    .select("id, status, consent_at")
    .eq("confirm_token_hash", sha256Hex(token))
    .maybeSingle();
  return data ? { db, row: data } : null;
}

/** Button-triggered (POST) so that link scanners opening the e-mail URL do not confirm. */
export async function confirmNewsletterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary(asLocale(formData.get("locale")));
  const found = await findByToken(String(formData.get("token") ?? ""));
  if (!found) return { ok: false, message: t.newsletter.invalidToken };
  const { db, row } = found;
  if (row.status === "confirmed") return { ok: true, message: t.newsletter.confirmed };
  if (row.status !== "pending" || Date.now() - Date.parse(row.consent_at) > CONFIRM_TTL_MS) {
    return { ok: false, message: t.newsletter.invalidToken };
  }
  const { error } = await db
    .from("newsletter_subscriptions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", row.id);
  return error ? { ok: false, message: t.common.error } : { ok: true, message: t.newsletter.confirmed };
}

export async function unsubscribeNewsletterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = getDictionary(asLocale(formData.get("locale")));
  const found = await findByToken(String(formData.get("token") ?? ""));
  if (!found) return { ok: false, message: t.newsletter.invalidToken };
  const { db, row } = found;
  if (row.status !== "unsubscribed") {
    const { error } = await db
      .from("newsletter_subscriptions")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return { ok: false, message: t.common.error };
  }
  return { ok: true, message: t.newsletter.unsubscribed };
}
