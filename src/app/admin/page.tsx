import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { Alert } from "@/components/ui/feedback";
import { Card, EmptyRow, OrderStatusBadge, PageHeader, PaymentStatusBadge, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";

type Stats = {
  net_revenue: number;
  paid_orders: number;
  pending_payment: number;
  to_fulfil: number;
  on_hold: number;
  pending_refunds: number;
  low_stock: number;
  new_customers: number;
  new_messages: number;
  daily: { day: string; revenue: number; orders: number }[];
};

function Kpi({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "alert" }) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl tabular-nums ${tone === "alert" ? "text-burgundy" : ""}`}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-sm border border-line bg-paper p-4 transition-colors hover:border-ink">
      {body}
    </Link>
  ) : (
    <div className="rounded-sm border border-line bg-paper p-4">{body}</div>
  );
}

function RevenueChart({ daily }: { daily: Stats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.revenue));
  return (
    <figure>
      <div className="flex h-44 items-end gap-[2px]" aria-hidden>
        {daily.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[1px] bg-olive transition-colors group-hover:bg-forest" style={{ height: `${Math.max(d.revenue > 0 ? 3 : 1, (d.revenue / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-[0.65rem] text-paper group-hover:block">
              {formatDate(d.day, "tr")}: {formatMoney(d.revenue)} · {d.orders} sipariş
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[0.68rem] text-muted">
        <span>{daily[0] ? formatDate(daily[0].day, "tr") : ""}</span>
        <span>Son 30 gün net ciro (günlük)</span>
        <span>{daily.at(-1) ? formatDate(daily.at(-1)!.day, "tr") : ""}</span>
      </figcaption>
      {/* Accessible data table equivalent of the chart */}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted">Tablo olarak göster</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1">Gün</th>
              <th className="py-1">Ciro</th>
              <th className="py-1">Sipariş</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1">{formatDate(d.day, "tr")}</td>
                <td className="py-1 tabular-nums">{formatMoney(d.revenue)}</td>
                <td className="py-1 tabular-nums">{d.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export default async function AdminDashboard({ searchParams }: { searchParams: SearchParams }) {
  const { roles } = await requireStaff("dashboard.view");
  const params = await searchParams;
  const supabase = await createClient();
  const canOrders = rolesHavePermission(roles, "orders.view");

  const [statsRes, ordersRes, lowRes] = await Promise.all([
    supabase.rpc("admin_dashboard_stats", { p_days: 30 }),
    canOrders
      ? supabase.from("orders").select("id, order_number, email, status, payment_status, grand_total, created_at").order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: [] as never[], error: null }),
    supabase.rpc("admin_low_stock_variants", { p_limit: 8 }),
  ]);

  const stats = statsRes.data as unknown as Stats | null;
  const aov = stats && stats.paid_orders > 0 ? Math.round(stats.net_revenue / stats.paid_orders) : 0;

  return (
    <div>
      <PageHeader title="Gösterge paneli" description="Son 30 günün gerçek sipariş ve stok verileri." />
      {sp(params, "forbidden") ? (
        <Alert tone="warning" className="mb-6">
          Bu sayfaya erişim yetkiniz yok. Yalnızca rolünüzün izin verdiği modüller menüde gösterilir.
        </Alert>
      ) : null}
      {statsRes.error || !stats ? (
        <Alert tone="danger" className="mb-6" title="Özet veriler alınamadı">
          Veritabanı bağlantısını kontrol edin.
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Net ciro (30 gün)" value={formatMoney(stats.net_revenue)} />
            <Kpi label="Ödenmiş sipariş (30 gün)" value={stats.paid_orders} href={canOrders ? "/admin/orders?payment_status=paid" : undefined} />
            <Kpi label="Ortalama sepet" value={formatMoney(aov)} />
            <Kpi label="Hazırlanacak" value={stats.to_fulfil} href={canOrders ? "/admin/orders?status=confirmed" : undefined} />
            <Kpi label="Ödeme bekleyen" value={stats.pending_payment} href={canOrders ? "/admin/orders?status=pending_payment" : undefined} />
            <Kpi label="İnceleme bekleyen" value={stats.on_hold} tone={stats.on_hold > 0 ? "alert" : undefined} href={canOrders ? "/admin/orders?status=on_hold" : undefined} />
            <Kpi label="Bekleyen iade" value={stats.pending_refunds} tone={stats.pending_refunds > 0 ? "alert" : undefined} />
            <Kpi label="Az stoklu varyant" value={stats.low_stock} tone={stats.low_stock > 0 ? "alert" : undefined} href={rolesHavePermission(roles, "inventory.manage") ? "/admin/inventory?low=1" : undefined} />
            <Kpi label="Yeni müşteri (30 gün)" value={stats.new_customers} />
            <Kpi label="Yeni mesaj" value={stats.new_messages} href={rolesHavePermission(roles, "inbox.manage") ? "/admin/inbox?status=new" : undefined} />
          </div>
          <Card title="Günlük ciro" className="mt-6">
            <RevenueChart daily={stats.daily ?? []} />
          </Card>
        </>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {canOrders ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Son siparişler</h2>
              <Link href="/admin/orders" className="text-xs underline underline-offset-4">
                Tümü
              </Link>
            </div>
            <TableWrap label="Son siparişler">
              <thead>
                <tr>
                  <Th>Sipariş</Th>
                  <Th>Durum</Th>
                  <Th>Ödeme</Th>
                  <Th className="text-right">Tutar</Th>
                </tr>
              </thead>
              <tbody>
                {(ordersRes.data ?? []).length === 0 ? <EmptyRow colSpan={4}>Henüz sipariş yok.</EmptyRow> : null}
                {(ordersRes.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                        {o.order_number}
                      </Link>
                      <span className="block text-xs text-muted">{formatDate(o.created_at, "tr", true)}</span>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td>
                      <PaymentStatusBadge status={o.payment_status} />
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(o.grand_total)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        ) : null}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Az stoklu varyantlar</h2>
            {rolesHavePermission(roles, "inventory.manage") ? (
              <Link href="/admin/inventory?low=1" className="text-xs underline underline-offset-4">
                Stok yönetimi
              </Link>
            ) : null}
          </div>
          <TableWrap label="Az stoklu varyantlar">
            <thead>
              <tr>
                <Th>Ürün</Th>
                <Th>SKU</Th>
                <Th className="text-right">Kullanılabilir</Th>
              </tr>
            </thead>
            <tbody>
              {(lowRes.data ?? []).length === 0 ? <EmptyRow colSpan={3}>Az stoklu varyant yok.</EmptyRow> : null}
              {(lowRes.data ?? []).map((v) => (
                <tr key={v.variant_id}>
                  <Td>
                    <Link href={`/admin/products/${v.product_id}#variants`} className="underline-offset-4 hover:underline">
                      {v.product_name}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs">{v.sku}</Td>
                  <Td className={`text-right tabular-nums ${v.available <= 0 ? "text-burgundy" : ""}`}>
                    {v.available} / eşik {v.low_stock_threshold}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </div>
    </div>
  );
}
