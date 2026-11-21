import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { pickLocale } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { ActiveBadge, EmptyRow, PageHeader, TableWrap, Td, Th } from "@/features/admin/ui/primitives";

export const metadata = { title: "Kategoriler" };

export default async function CategoriesPage() {
  await requireStaff("catalog.manage");
  const supabase = await createClient();
  const [{ data: cats }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("id, slug, name, parent_id, position, is_active").order("position"),
    supabase.from("products").select("category_id"),
  ]);
  const productCount = new Map<string, number>();
  for (const p of counts ?? []) if (p.category_id) productCount.set(p.category_id, (productCount.get(p.category_id) ?? 0) + 1);

  // Depth-first ordering for an indented tree.
  const rows = cats ?? [];
  const ordered: { row: (typeof rows)[number]; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const r of rows.filter((x) => x.parent_id === parent)) {
      ordered.push({ row: r, depth });
      if (depth < 5) visit(r.id, depth + 1);
    }
  };
  visit(null, 0);
  // Orphans (parent missing) are appended.
  for (const r of rows) if (!ordered.some((o) => o.row.id === r.id)) ordered.push({ row: r, depth: 0 });

  return (
    <div>
      <PageHeader
        title="Kategoriler"
        description="Mağaza navigasyonu ve filtreleme için kategori ağacı."
        actions={
          <ButtonLink href="/admin/categories/new">
            <Plus className="h-4 w-4" aria-hidden /> Yeni kategori
          </ButtonLink>
        }
      />
      <TableWrap label="Kategoriler">
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
          {ordered.length === 0 ? <EmptyRow colSpan={5}>Henüz kategori yok.</EmptyRow> : null}
          {ordered.map(({ row, depth }) => (
            <tr key={row.id}>
              <Td>
                <span style={{ paddingLeft: `${depth * 1.25}rem` }} className="inline-flex items-center gap-1">
                  {depth > 0 ? <span aria-hidden className="text-muted">└</span> : null}
                  <Link href={`/admin/categories/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {pickLocale(row.name, "tr")}
                  </Link>
                </span>
              </Td>
              <Td className="text-xs text-muted">/{row.slug}</Td>
              <Td className="text-right tabular-nums">{row.position}</Td>
              <Td className="text-right tabular-nums">{productCount.get(row.id) ?? 0}</Td>
              <Td>
                <ActiveBadge active={row.is_active} />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
