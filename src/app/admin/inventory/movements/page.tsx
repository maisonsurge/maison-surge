import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { sanitizeSearch } from "@/server/admin/common";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/feedback";
import { EmptyRow, FilterBar, FilterField, PageHeader, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";

export const metadata = { title: "Stok hareketleri" };

const TYPE_LABEL: Record<string, string> = {
  initial: "Başlangıç",
  adjustment: "Düzeltme",
  sale: "Satış",
  cancel_restock: "İptal iadesi",
  return_restock: "Ürün iadesi",
};

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("inventory.manage");
  const params = await searchParams;
  const q = sanitizeSearch(sp(params, "sku")).toUpperCase();
  const supabase = await createClient();
  let query = supabase.from("inventory_movements").select("id, sku, type, quantity_delta, on_hand_after, order_id, reason, actor_id, created_at").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("sku", `%${q}%`);
  const { data } = await query;

  return (
    <div>
      <PageHeader title="Stok hareketleri" description="Son 100 hareket. Her stok değişikliği değiştirilemez şekilde kaydedilir." back={{ href: "/admin/inventory", label: "Stok" }} />
      <FilterBar action="/admin/inventory/movements">
        <FilterField label="SKU" className="flex-1">
          <Input name="sku" defaultValue={q} />
        </FilterField>
      </FilterBar>
      <TableWrap label="Stok hareketleri">
        <thead>
          <tr>
            <Th>Tarih</Th>
            <Th>SKU</Th>
            <Th>Tür</Th>
            <Th className="text-right">Değişim</Th>
            <Th className="text-right">Sonraki stok</Th>
            <Th>Açıklama</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={6} /> : null}
          {(data ?? []).map((m) => (
            <tr key={m.id}>
              <Td className="whitespace-nowrap text-xs">{formatDate(m.created_at, "tr", true)}</Td>
              <Td className="font-mono text-xs">{m.sku}</Td>
              <Td>
                <Badge tone={m.type === "sale" ? "info" : m.type === "adjustment" ? "neutral" : "success"}>{TYPE_LABEL[m.type] ?? m.type}</Badge>
              </Td>
              <Td className={`text-right tabular-nums ${m.quantity_delta < 0 ? "text-burgundy" : ""}`}>{m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}</Td>
              <Td className="text-right tabular-nums">{m.on_hand_after}</Td>
              <Td className="text-xs">
                {m.reason ?? "—"}
                {m.order_id ? (
                  <Link href={`/admin/orders/${m.order_id}`} className="ml-2 underline underline-offset-4">
                    Sipariş
                  </Link>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
