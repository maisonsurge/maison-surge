import "server-only";
import { serverEnv } from "@/server/env";
import { publicEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { maskEmail, pickLocale } from "@/lib/utils";
import { getDictionary, localePath, type Locale } from "@/i18n";
import type { OrderViewData } from "@/server/orders";

export type EmailMessage = { to: string; subject: string; html: string; text: string };
export type EmailResult = { sent: boolean; reason?: string };

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM);
}

/**
 * Sends via the Resend REST API when RESEND_API_KEY + EMAIL_FROM are set.
 * Otherwise nothing is sent and { sent:false, reason:"not_configured" } is
 * returned — callers must never claim delivery in that case. Logs mask the
 * recipient address.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const masked = maskEmail(message.to);
  if (!isEmailConfigured()) {
    console.info("[email] not sent (provider not configured)", { to: masked, subject: message.subject });
    return { sent: false, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: serverEnv.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[email] provider rejected message", { to: masked, status: res.status });
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", { to: masked, error: err instanceof Error ? err.message : "unknown" });
    return { sent: false, reason: "network" };
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Minimal brand-styled wrapper (inline styles — e-mail clients ignore CSS files). */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#E5DECF;font-family:Montserrat,Arial,sans-serif;color:#1A1A1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E5DECF;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBFAF7;border:1px solid #D9D1C1">
<tr><td style="padding:28px 32px;border-bottom:1px solid #D9D1C1;text-align:center;font-family:'Playfair Display',Georgia,serif;letter-spacing:0.28em;font-size:18px">MAISON SURGE</td></tr>
<tr><td style="padding:28px 32px"><h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Guest orders are only viewable with the private access token (only its hash
 * is stored), so pass `opts.orderUrl` when the caller has it; otherwise guest
 * e-mails omit the link.
 */
export function orderConfirmationEmail(
  order: OrderViewData,
  locale: Locale,
  opts: { orderUrl?: string } = {},
): { subject: string; html: string; text: string } {
  const t = getDictionary(locale);
  const money = (n: number) => formatMoney(n, locale, order.currency);
  const subject = `${t.order.title.replace("{number}", order.orderNumber)} — MAISON SURGE`;
  const link = opts.orderUrl ?? (order.isGuest ? null : `${publicEnv.siteUrl}${localePath(locale, `/account/orders/${order.orderNumber}`)}`);
  const shippingName = pickLocale(order.shippingMethodName, locale);

  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #D9D1C1;font-size:14px">${escapeHtml(i.name)}${
          i.variantLabel ? `<br><span style="color:#5F5B53;font-size:12px">${escapeHtml(i.variantLabel)}</span>` : ""
        }</td><td style="padding:8px 0;border-bottom:1px solid #D9D1C1;font-size:14px;text-align:right;white-space:nowrap">${i.quantity} × ${escapeHtml(
          money(i.unitPrice),
        )}</td></tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;font-size:14px${bold ? ";font-weight:600" : ""}">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;text-align:right${
      bold ? ";font-weight:600" : ""
    }">${escapeHtml(value)}</td></tr>`;

  const html = emailLayout(
    t.order.thanks,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 20px">${escapeHtml(t.order.paidBody)}</p>
<p style="font-size:13px;color:#5F5B53;margin:0 0 8px">${escapeHtml(t.order.title.replace("{number}", order.orderNumber))}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
${line(t.cart.subtotal, money(order.subtotal))}
${order.discountTotal > 0 ? line(t.cart.discount, `−${money(order.discountTotal)}`) : ""}
${line(`${t.cart.shipping}${shippingName ? ` — ${shippingName}` : ""}`, order.shippingTotal === 0 ? t.cart.free : money(order.shippingTotal))}
${line(t.cart.total, money(order.grandTotal), true)}
</table>
${link ? `<p style="margin:28px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1A1A1A;color:#FBFAF7;text-decoration:none;padding:12px 22px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase">${escapeHtml(
      t.account.viewOrder,
    )}</a></p>` : ""}`,
  );

  const text = [
    t.order.thanks,
    t.order.paidBody,
    "",
    t.order.title.replace("{number}", order.orderNumber),
    ...order.items.map((i) => `- ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}: ${i.quantity} × ${money(i.unitPrice)}`),
    "",
    `${t.cart.subtotal}: ${money(order.subtotal)}`,
    ...(order.discountTotal > 0 ? [`${t.cart.discount}: −${money(order.discountTotal)}`] : []),
    `${t.cart.shipping}: ${order.shippingTotal === 0 ? t.cart.free : money(order.shippingTotal)}`,
    `${t.cart.total}: ${money(order.grandTotal)}`,
    ...(link ? ["", link] : []),
  ].join("\n");

  return { subject, html, text };
}
