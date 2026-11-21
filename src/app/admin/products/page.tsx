import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { formatMoney } from "@/lib/money";
import { imageUrl, isUnoptimizable } from "@/lib/images";
import { formatDate, pickLocale } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/feedback";
import { sanitizeSearch } from "@/server/admin/common";
import { pageRange } from "@/features/admin/lib/helpers";
import { EmptyRow, FilterBar, FilterField, PageHeader, Pagination, PublishBadge, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";

export const metadata = { title: "Ürünler" };
const PAGE_SIZE = 20;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("catalog.manage");
  const params = await searchParams;
  const q = sanitizeSearch(sp(params, "q"));
  const status = sp(params, "status");
  const category = sp(params, "category");
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();

  const { data: categories } = await supabase.from("categories").select("id, name").order("position");

  let ids: string[] | null = null;
  if (q) {
    const [byName, bySku] = await Promise.all([
      supabase.from("product_translations").select("product_id").ilike("name", `%${q}%`).limit(500),
      supabase.from("product_variants").select("product_id").ilike("sku", `%${q}%`).limit(500),
    ]);
    ids = [...new Set([...(byName.data ?? []).map((r) => r.product_id), ...(bySku.data ?? []).map((r) => r.product_id)])];
  }

  const { from, to } = pageRange(page, PAGE_SIZE);
  let query = supabase
    .from("products")
    .select(
      "id, slug, status, base_price, is_featured, is_demo, updated_at, categories ( name ), product_translations ( locale, name ), product_variants ( stock_on_hand, stock_reserved, is_active ), product_images ( path, is_cover, position )",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (status === "draft" || status === "published" || status === "archived") query = query.eq("status", status);
  if (category) query = query.eq("category_id", category);
  if (ids) query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data: products, count, error } = await query;
  const total = count ?? 0;

  return (
    <div>
      <PageHeader
        title="Ürünler"
        description="Ürün, varyant, görsel ve stok yönetimi."
        actions={
          <ButtonLink href="/admin/products/new">
            <Plus className="h-4 w-4" aria-hidden /> Yeni ürün
          </ButtonLink>
        }
      />
      <FilterBar action="/admin/products">
        <FilterField label="Ara (ad / SKU)" className="flex-1">
          <Input name="q" defaultValue={q} placeholder="örn. polo veya DABC-..." />
        </FilterField>
        <FilterField label="Durum">
          <Select name="status" defaultValue={status}>
            <option value="">Tümü</option>
            <option value="published">Yayında</option>
            <option value="draft">Taslak</option>
            <option value="archived">Arşiv</option>
          </Select>
        </FilterField>
        <FilterField label="Kategori">
          <Select name="category" defaultValue={category}>
            <option value="">Tümü</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {pickLocale(c.name, "tr")}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {error ? <p className="mb-3 text-sm text-danger">Ürünler yüklenemedi.</p> : null}
      <TableWrap label="Ürün listesi">
        <thead>
          <tr>
            <Th className="w-16">Görsel</Th>
            <Th>Ürün</Th>
            <Th>Kategori</Th>
            <Th>Durum</Th>
            <Th className="text-right">Fiyat</Th>
            <Th className="text-right">Stok (kullanılabilir)</Th>
            <Th>Güncelleme</Th>
          </tr>
        </thead>
        <tbody>
          {(products ?? []).length === 0 ? <EmptyRow colSpan={7}>Ürün bulunamadı.</EmptyRow> : null}
          {(products ?? []).map((p) => {
            const name = p.product_translations.find((t) => t.locale === "tr")?.name ?? p.slug;
            const cover = [...p.product_images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position)[0];
            const src = imageUrl(cover?.path);
            const available = p.product_variants.filter((v) => v.is_active).reduce((n, v) => n + Math.max(0, v.stock_on_hand - v.stock_reserved), 0);
            return (
              <tr key={p.id}>
                <Td>
                  <div className="relative h-12 w-10 overflow-hidden bg-sand-100">
                    {src ? <Image src={src} alt="" fill sizes="40px" className="object-cover" unoptimized={isUnoptimizable(src)} /> : null}
                  </div>
                </Td>
                <Td>
                  <Link href={`/admin/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                    {name}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted">
                    /{p.slug}
                    {p.is_featured ? <Badge tone="info">Öne çıkan</Badge> : null}
                    {p.is_demo ? <Badge tone="warning">Demo</Badge> : null}
                  </span>
                </Td>
                <Td>{p.categories ? pickLocale(p.categories.name, "tr") : <span className="text-muted">—</span>}</Td>
                <Td>
                  <PublishBadge status={p.status} />
                </Td>
                <Td className="text-right tabular-nums">{formatMoney(p.base_price)}</Td>
                <Td className={`text-right tabular-nums ${available === 0 ? "text-burgundy" : ""}`}>
                  {available} <span className="text-xs text-muted">({p.product_variants.length} varyant)</span>
                </Td>
                <Td className="text-xs text-muted">{formatDate(p.updated_at, "tr", true)}</Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} basePath="/admin/products" params={{ q, status, category }} />
    </div>
  );
}
