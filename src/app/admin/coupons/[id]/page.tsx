import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteCoupon, saveCoupon } from "@/server/admin/coupons";
import { isUuid } from "@/server/admin/common";
import { formatMoney } from "@/lib/money";
import { formatDate, maskEmail } from "@/lib/utils";
import { Alert, Badge } from "@/components/ui/feedback";
import { Card, EmptyRow, PageHeader, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { CouponForm } from "@/features/admin/coupons/coupon-form";

export const metadata = { title: "Kupon düzenle" };
const RED: Record<string, string> = { reserved: "Rezerve", applied: "Kullanıldı", released: "Serbest" };

export default async function EditCouponPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireStaff("coupons.manage");
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: c }, { data: redemptions }] = await Promise.all([
    supabase.from("coupons").select("*").eq("id", id).maybeSingle(),
    supabase.from("coupon_redemptions").select("id, email, amount, status, created_at, order_id, orders ( order_number )").eq("coupon_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!c) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={<span className="font-mono">{c.code}</span>}
        back={{ href: "/admin/coupons", label: "Kuponlar" }}
        actions={
          <ActionButton action={deleteCoupon.bind(null, c.id)} variant="danger" confirm={{ title: "Kupon silinsin mi?", body: "Kullanılmış kuponlar silinemez; pasif yapın.", confirmLabel: "Sil" }}>
            Sil
          </ActionButton>
        }
      />
      {sp(query, "created") ? (
        <Alert tone="success" className="mb-6">
          Kupon oluşturuldu.
        </Alert>
      ) : null}
      <CouponForm action={saveCoupon.bind(null, c.id)} values={c} />
      <Card title={`Kullanımlar (${(redemptions ?? []).length})`} className="mt-8">
        <TableWrap label="Kupon kullanımları">
          <thead>
            <tr>
              <Th>Sipariş</Th>
              <Th>Müşteri</Th>
              <Th>Tarih</Th>
              <Th className="text-right">İndirim</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {(redemptions ?? []).length === 0 ? <EmptyRow colSpan={5}>Henüz kullanılmadı.</EmptyRow> : null}
            {(redemptions ?? []).map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/orders/${r.order_id}`} className="underline-offset-4 hover:underline">
                    {r.orders?.order_number ?? "—"}
                  </Link>
                </Td>
                <Td className="text-xs">{maskEmail(r.email)}</Td>
                <Td className="text-xs">{formatDate(r.created_at, "tr", true)}</Td>
                <Td className="text-right tabular-nums">{formatMoney(r.amount)}</Td>
                <Td>
                  <Badge tone={r.status === "applied" ? "success" : r.status === "reserved" ? "warning" : "neutral"}>{RED[r.status] ?? r.status}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
