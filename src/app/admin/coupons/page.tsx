import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { EmptyRow, PageHeader, TableWrap, Td, Th } from "@/features/admin/ui/primitives";
import { windowState } from "@/features/admin/lib/helpers";

export const metadata = { title: "Kuponlar" };

export default async function CouponsPage() {
  await requireStaff("coupons.manage");
  const supabase = await createClient();
  const [{ data: coupons }, { data: redemptions }] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("coupon_redemptions").select("coupon_id, status"),
  ]);
  const used = new Map<string, number>();
  for (const r of redemptions ?? []) if (r.status !== "released") used.set(r.coupon_id, (used.get(r.coupon_id) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title="Kuponlar"
        description="Kurallar sepette ve sipariş anında veritabanında yeniden doğrulanır; kullanım limiti yarış koşullarına karşı kilitlidir."
        actions={
          <ButtonLink href="/admin/coupons/new">
            <Plus className="h-4 w-4" aria-hidden /> Yeni kupon
          </ButtonLink>
        }
      />
      <TableWrap label="Kuponlar">
        <thead>
          <tr>
            <Th>Kod</Th>
            <Th>İndirim</Th>
            <Th>Geçerlilik</Th>
            <Th className="text-right">Kullanım</Th>
            <Th>Durum</Th>
          </tr>
        </thead>
        <tbody>
          {(coupons ?? []).length === 0 ? <EmptyRow colSpan={5}>Henüz kupon yok.</EmptyRow> : null}
          {(coupons ?? []).map((c) => {
            const state = windowState(c.starts_at, c.ends_at);
            const expired = state === "expired";
            const upcoming = state === "upcoming";
            return (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/coupons/${c.id}`} className="font-mono font-medium underline-offset-4 hover:underline">
                    {c.code}
                  </Link>
                  {c.description ? <span className="block text-xs text-muted">{c.description}</span> : null}
                </Td>
                <Td>
                  {c.type === "percent" ? `%${c.value}` : formatMoney(c.value)}
                  {c.min_subtotal > 0 ? <span className="block text-xs text-muted">Asgari {formatMoney(c.min_subtotal)}</span> : null}
                </Td>
                <Td className="text-xs">
                  {c.starts_at ? formatDate(c.starts_at, "tr", true) : "—"} → {c.ends_at ? formatDate(c.ends_at, "tr", true) : "süresiz"}
                </Td>
                <Td className="text-right tabular-nums">
                  {used.get(c.id) ?? 0}
                  {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                </Td>
                <Td>
                  {!c.is_active ? <Badge>Pasif</Badge> : expired ? <Badge>Süresi doldu</Badge> : upcoming ? <Badge tone="warning">Planlandı</Badge> : <Badge tone="success">Aktif</Badge>}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
