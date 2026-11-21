import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { isUuid } from "@/server/admin/common";
import { cancelOrder, createRefund, markOrderShipped, markRefundManual, retryRefund, saveInternalNote, updateOrderStatus } from "@/server/admin/orders";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { allowedAdminTransitions, canRefund } from "@/lib/orders/transitions";
import { formatMoney, toInputValue } from "@/lib/money";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { formatDate, pickLocale } from "@/lib/utils";
import type { Json } from "@/types/database.types";
import { Alert, Badge } from "@/components/ui/feedback";
import { Card, KeyValue, ORDER_STATUS_LABELS, OrderStatusBadge, PageHeader, PaymentStatusBadge } from "@/features/admin/ui/primitives";
import { ActionForm, CheckboxField, FormSubmit, MoneyField, TextAreaField, TextField } from "@/features/admin/ui/action-form";
import { ActionButton } from "@/features/admin/ui/action-button";
import { ConfirmSubmit } from "@/features/admin/ui/confirm-submit";

export const metadata = { title: "Sipariş detayı" };

function Address({ value }: { value: Json }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return <p className="text-sm text-muted">—</p>;
  const a = value as Record<string, unknown>;
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  return (
    <address className="text-sm not-italic leading-relaxed">
      <strong className="font-medium">{s("full_name")}</strong>
      <br />
      {s("line1")}
      {s("line2") ? (
        <>
          <br />
          {s("line2")}
        </>
      ) : null}
      <br />
      {[s("postal_code"), s("district"), s("city")].filter(Boolean).join(" ")} {s("country")}
      {s("phone") ? (
        <>
          <br />
          {s("phone")}
        </>
      ) : null}
    </address>
  );
}

function BillingInfo({ value }: { value: Json }) {
  const b = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  if (b.type === "corporate") {
    return (
      <KeyValue
        items={[
          ["Tür", "Kurumsal"],
          ["Unvan", String(b.company_name ?? "—")],
          ["Vergi dairesi", String(b.tax_office ?? "—")],
          ["Vergi no", String(b.tax_number ?? "—")],
        ]}
      />
    );
  }
  return <p className="text-sm">Bireysel fatura</p>;
}

const REFUND_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Beklemede", tone: "warning" },
  completed: { label: "Tamamlandı", tone: "success" },
  failed: { label: "Başarısız", tone: "danger" },
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { roles } = await requireStaff("orders.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const canManage = rolesHavePermission(roles, "orders.manage");
  const canRefundPerm = rolesHavePermission(roles, "orders.refund");

  const { data: o } = await supabase
    .from("orders")
    .select(
      `*, order_items ( id, sku, product_name, variant_label, image_path, unit_price, quantity, line_total, product_id ),
       order_status_history ( id, from_status, to_status, payment_status, note, is_internal, created_at ),
       payments ( id, provider, provider_payment_id, status, amount, currency, failure_reason, is_test, created_at ),
       shipments ( id, carrier, tracking_number, tracking_url, shipped_at, delivered_at ),
       refunds ( id, amount, reason, status, restock, provider_refund_id, manual_reference, failure_reason, created_at, completed_at )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const { data: events } = canRefundPerm
    ? await supabase.from("payment_events").select("id, provider, event_id, event_type, result, received_at").eq("order_id", id).order("received_at", { ascending: false })
    : { data: null };

  const transitions = allowedAdminTransitions(o.status);
  const statusMoves = transitions.filter((t) => t.via === "status");
  const canShip = transitions.some((t) => t.via === "ship") && o.payment_status === "paid";
  const canCancel = transitions.some((t) => t.via === "cancel") && (o.payment_status !== "paid" || canRefundPerm);
  const pendingRefunds = o.refunds.filter((r) => r.status === "pending");
  const refundable = o.grand_total - o.refunded_total - pendingRefunds.reduce((n, r) => n + r.amount, 0);
  const history = [...o.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const shippingName = pickLocale(o.shipping_method_name, "tr");

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={`Sipariş ${o.order_number}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.payment_status} />
            <span>{formatDate(o.created_at, "tr", true)}</span>
            {o.payment_provider ? <span>· {o.payment_provider}</span> : null}
          </span>
        }
        back={{ href: "/admin/orders", label: "Siparişler" }}
      />

      {o.status === "on_hold" ? (
        <Alert tone="danger" className="mb-6" title="Manuel inceleme gerekli">
          Bu sipariş ödeme tutarı uyuşmazlığı veya süresi dolduktan sonra gelen ödeme nedeniyle beklemede. İç notu kontrol edin; stok uygunsa “Onaylandı” yapın, değilse iptal edip iade başlatın.
        </Alert>
      ) : null}
      {o.payments.some((p) => p.is_test) ? (
        <Alert tone="warning" className="mb-6">
          Bu sipariş TEST ödeme sağlayıcısı ile ödendi; gerçek para tahsil edilmedi.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 gap-6">
          <Card title="Ürünler">
            <ul className="divide-y divide-line">
              {o.order_items.map((it) => {
                const src = imageUrl(it.image_path);
                return (
                  <li key={it.id} className="flex gap-3 py-3 first:pt-0">
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-sand-100">
                      {src ? <Image src={src} alt="" fill sizes="48px" className="object-cover" unoptimized={isUnoptimizable(src)} /> : null}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      {it.product_id ? (
                        <Link href={`/admin/products/${it.product_id}`} className="font-medium underline-offset-4 hover:underline">
                          {it.product_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{it.product_name}</span>
                      )}
                      <p className="text-xs text-muted">
                        {it.variant_label} · <span className="font-mono">{it.sku}</span>
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p>
                        {it.quantity} × {formatMoney(it.unit_price)}
                      </p>
                      <p className="font-medium">{formatMoney(it.line_total)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 grid gap-1 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Ara toplam</dt>
                <dd className="tabular-nums">{formatMoney(o.subtotal)}</dd>
              </div>
              {o.discount_total > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted">İndirim {o.coupon_code ? `(${o.coupon_code})` : ""}</dt>
                  <dd className="tabular-nums text-burgundy">−{formatMoney(o.discount_total)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted">Kargo {shippingName ? `(${shippingName})` : ""}</dt>
                <dd className="tabular-nums">{o.shipping_total === 0 ? "Ücretsiz" : formatMoney(o.shipping_total)}</dd>
              </div>
              {o.vat_total > 0 ? (
                <div className="flex justify-between text-xs text-muted">
                  <dt>Dahil KDV</dt>
                  <dd className="tabular-nums">{formatMoney(o.vat_total)}</dd>
                </div>
              ) : null}
              <div className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
                <dt>Genel toplam</dt>
                <dd className="tabular-nums">{formatMoney(o.grand_total)}</dd>
              </div>
              {o.refunded_total > 0 ? (
                <div className="flex justify-between text-burgundy">
                  <dt>İade edilen</dt>
                  <dd className="tabular-nums">−{formatMoney(o.refunded_total)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {canManage && (statusMoves.length > 0 || canShip || canCancel) ? (
            <Card title="İşlemler">
              <div className="grid gap-6">
                {statusMoves.map((t) => (
                  <ActionForm key={t.to} action={updateOrderStatus.bind(null, o.id)} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="to" value={t.to} />
                    <TextField name="note" label={`Not (isteğe bağlı) → ${ORDER_STATUS_LABELS[t.to]}`} className="min-w-[14rem] flex-1" maxLength={500} />
                    <FormSubmit variant="secondary">“{ORDER_STATUS_LABELS[t.to]}” yap</FormSubmit>
                  </ActionForm>
                ))}
                {canShip ? (
                  <ActionForm action={markOrderShipped.bind(null, o.id)} className="grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
                    <p className="text-sm font-semibold sm:col-span-3">Kargoya ver</p>
                    <TextField name="carrier" label="Kargo firması *" maxLength={60} required />
                    <TextField name="tracking_number" label="Takip numarası *" maxLength={80} required />
                    <TextField name="tracking_url" label="Takip bağlantısı (https)" type="url" maxLength={500} placeholder="https://" />
                    <div className="sm:col-span-3">
                      <FormSubmit>Kargoya verildi olarak işaretle</FormSubmit>
                    </div>
                  </ActionForm>
                ) : null}
                {canCancel ? (
                  <ActionForm action={cancelOrder.bind(null, o.id)} className="grid gap-3 border-t border-line pt-5">
                    <p className="text-sm font-semibold">Siparişi iptal et</p>
                    {o.payment_status === "paid" ? (
                      <p className="text-xs text-muted">
                        Sipariş ödenmiş: iptal, kalan tutar ({formatMoney(refundable)}) için iade kaydı oluşturur ve sağlayıcı üzerinden iadeyi dener.
                      </p>
                    ) : (
                      <p className="text-xs text-muted">Ödenmemiş sipariş: rezerve stok serbest bırakılır.</p>
                    )}
                    <TextAreaField name="reason" label="İptal gerekçesi *" rows={2} maxLength={500} required />
                    {o.payment_status === "paid" ? <CheckboxField name="restock" label="Ürünleri stoğa geri ekle" defaultChecked /> : <input type="hidden" name="restock" value="on" />}
                    <div>
                      <ConfirmSubmit title={`${o.order_number} iptal edilsin mi?`} body="Bu işlem geri alınamaz." confirmLabel="Siparişi iptal et">
                        Siparişi iptal et
                      </ConfirmSubmit>
                    </div>
                  </ActionForm>
                ) : null}
              </div>
            </Card>
          ) : null}

          {canRefundPerm && canRefund(o.status, o.payment_status) && refundable > 0 ? (
            <Card title="İade (ürün iadesi / kısmi iade)">
              <ActionForm action={createRefund.bind(null, o.id)} className="grid gap-3 sm:grid-cols-2">
                <MoneyField name="amount" label="İade tutarı *" defaultValue={toInputValue(refundable)} hint={`En fazla ${formatMoney(refundable)}`} />
                <TextField name="reason" label="Gerekçe *" maxLength={500} required />
                <div className="sm:col-span-2">
                  <CheckboxField name="restock" label="Tüm ürünleri stoğa geri ekle (ürünler depoya döndüyse)" />
                </div>
                <div className="sm:col-span-2">
                  <ConfirmSubmit title="İade başlatılsın mı?" body="Sağlayıcı destekliyorsa iade hemen gerçekleştirilir." confirmLabel="İadeyi başlat" variant="primary">
                    İade başlat
                  </ConfirmSubmit>
                </div>
              </ActionForm>
            </Card>
          ) : null}

          {o.refunds.length > 0 ? (
            <Card title="İadeler">
              <ul className="grid gap-4">
                {o.refunds.map((r) => (
                  <li key={r.id} className="rounded-sm border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span>
                      <Badge tone={REFUND_STATUS[r.status]?.tone ?? "neutral"}>{REFUND_STATUS[r.status]?.label ?? r.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(r.created_at, "tr", true)}
                      {r.restock ? " · stoğa iade edildi" : ""}
                      {r.provider_refund_id ? ` · sağlayıcı ref: ${r.provider_refund_id}` : ""}
                      {r.manual_reference ? ` · manuel ref: ${r.manual_reference}` : ""}
                      {r.failure_reason ? ` · hata: ${r.failure_reason}` : ""}
                    </p>
                    {r.status === "pending" && canRefundPerm ? (
                      <div className="mt-3 grid gap-3 border-t border-line pt-3">
                        <ActionButton action={retryRefund.bind(null, o.id, r.id)} variant="outline">
                          İadeyi sağlayıcı üzerinden tekrar dene
                        </ActionButton>
                        <ActionForm action={markRefundManual.bind(null, o.id, r.id)} className="grid gap-2">
                          <p className="text-xs font-semibold">Manuel iade onayı</p>
                          <p className="text-xs text-muted">Yalnızca iadeyi ödeme sağlayıcısının panelinden gerçekten yaptıysanız kullanın. İşlem denetim kaydına yazılır.</p>
                          <TextField name="reference" label="Sağlayıcı iade referansı *" maxLength={200} />
                          <CheckboxField name="confirm" label="İadenin sağlayıcı panelinde tamamlandığını onaylıyorum." />
                          <div>
                            <FormSubmit size="sm" variant="secondary">
                              İadeyi tamamlandı olarak kaydet
                            </FormSubmit>
                          </div>
                        </ActionForm>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Durum geçmişi">
            <ol className="grid gap-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-olive" />
                  <div>
                    <p>
                      <span className="font-medium">{ORDER_STATUS_LABELS[h.to_status]}</span>
                      <span className="text-muted"> · {formatDate(h.created_at, "tr", true)}</span>
                      {h.is_internal ? <Badge className="ml-2">İç</Badge> : null}
                    </p>
                    {h.note ? <p className="text-xs text-muted">{h.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Ödemeler">
            {o.payments.length === 0 ? (
              <p className="text-sm text-muted">Ödeme denemesi yok.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 last:border-0">
                    <span>
                      {p.provider}
                      {p.is_test ? <Badge tone="warning" className="ml-2">Test</Badge> : null}
                      <span className="block text-xs text-muted">
                        {formatDate(p.created_at, "tr", true)}
                        {p.provider_payment_id ? ` · ${p.provider_payment_id}` : ""}
                        {p.failure_reason ? ` · ${p.failure_reason}` : ""}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {formatMoney(p.amount)}
                      <span className="block text-xs text-muted">{p.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {events ? (
            <Card title="Ödeme olayları (webhook)">
              {events.length === 0 ? (
                <p className="text-sm text-muted">Olay yok.</p>
              ) : (
                <ul className="grid gap-1 font-mono text-xs">
                  {events.map((e) => (
                    <li key={e.id} className="break-all">
                      {formatDate(e.received_at, "tr", true)} · {e.provider} · {e.event_type} · {e.result ?? "işlenmedi"} · {e.event_id}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-6">
          <Card title="Müşteri">
            <KeyValue
              items={[
                ["E-posta", <a key="e" href={`mailto:${o.email}`} className="underline underline-offset-4">{o.email}</a>],
                ["Telefon", o.phone],
                ["Hesap", o.user_id ? (rolesHavePermission(roles, "customers.view") ? <Link key="u" href={`/admin/customers/${o.user_id}`} className="underline underline-offset-4">Üye profili</Link> : "Üye") : "Misafir"],
                ["Dil", o.locale.toUpperCase()],
              ]}
            />
          </Card>
          <Card title="Teslimat adresi">
            <Address value={o.shipping_address} />
          </Card>
          <Card title="Fatura">
            <Address value={o.billing_address} />
            <div className="mt-3 border-t border-line pt-3">
              <BillingInfo value={o.billing_info} />
            </div>
          </Card>
          {o.customer_note ? (
            <Card title="Müşteri notu">
              <p className="whitespace-pre-wrap text-sm">{o.customer_note}</p>
            </Card>
          ) : null}
          <Card title="Kargo">
            {o.shipments.length === 0 ? (
              <p className="text-sm text-muted">Henüz kargoya verilmedi.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {o.shipments.map((s) => (
                  <li key={s.id}>
                    <p className="font-medium">{s.carrier}</p>
                    <p className="font-mono text-xs">{s.tracking_number}</p>
                    {s.tracking_url ? (
                      <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-4">
                        Takip bağlantısı
                      </a>
                    ) : null}
                    <p className="text-xs text-muted">
                      Gönderim: {formatDate(s.shipped_at, "tr", true)}
                      {s.delivered_at ? ` · Teslim: ${formatDate(s.delivered_at, "tr", true)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="İç not (müşteri görmez)">
            {canManage ? (
              <ActionForm action={saveInternalNote.bind(null, o.id)} className="grid gap-3" successMessage="İç not kaydedildi.">
                <TextAreaField name="internal_note" label="Not" rows={4} defaultValue={o.internal_note ?? ""} maxLength={2000} />
                <FormSubmit size="sm" variant="outline">
                  Notu kaydet
                </FormSubmit>
              </ActionForm>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{o.internal_note ?? "—"}</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
