import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { pickLocale } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { ActiveBadge, EmptyRow, PageHeader, TableWrap, Td, Th } from "@/features/admin/ui/primitives";

export const metadata = { title: "Koleksiyonlar" };

export default async function CollectionsPage() {
  await requireStaff("catalog.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("id, slug, name, position, is_active, collection_products ( product_id )").order("position");
  return (
    <div>
      <PageHeader
        title="Koleksiyonlar"
        description="Sezon, kampanya veya temaya göre ürün grupları."
        actions={
          <ButtonLink href="/admin/collections/new">
            <Plus className="h-4 w-4" aria-hidden /> Yeni koleksiyon
          </ButtonLink>
        }
      />
      <TableWrap label="Koleksiyonlar">
        <thead>
          <tr>
            <Th>Ad</Th>
            <Th>Slug</Th>
            <Th className="text-right">Sıra</Th>
            <Th className="text-right">Ürün</Th>
            <Th>Durum</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={5}>Henüz koleksiyon yok.</EmptyRow> : null}
          {(data ?? []).map((c) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/admin/collections/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                  {pickLocale(c.name, "tr")}
                </Link>
              </Td>
              <Td className="text-xs text-muted">/{c.slug}</Td>
              <Td className="text-right tabular-nums">{c.position}</Td>
              <Td className="text-right tabular-nums">{c.collection_products.length}</Td>
              <Td>
                <ActiveBadge active={c.is_active} />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
