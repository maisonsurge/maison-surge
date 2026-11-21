import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { sanitizeSearch } from "@/server/admin/common";
import { pickLocale } from "@/lib/utils";
import { pageRange } from "@/features/admin/lib/helpers";
import { Input } from "@/components/ui/form";
import { Card, EmptyRow, FilterBar, FilterField, PageHeader, Pagination, TableWrap, Td, Th, sp, type SearchParams } from "@/features/admin/ui/primitives";
import { StockCell } from "@/features/admin/inventory/stock-cell";
import { StockImport } from "@/features/admin/inventory/stock-import";

export const metadata = { title: "Stok" };
const PAGE_SIZE = 50;

type Row = { id: string; productId: string; product: string; sku: string; variant: string; onHand: number; reserved: number; threshold: number; active: boolean };

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("inventory.manage");
  const params = await searchParams;
  const low = sp(params, "low") === "1";
  const q = sanitizeSearch(sp(params, "q")).toUpperCase();
  const page = Math.max(1, Number(sp(params, "page")) || 1);
  const supabase = await createClient();

  let rows: Row[] = [];
  let total = 0;
  if (low) {
    const { data } = await supabase.rpc("admin_low_stock_variants", { p_limit: 500 });
    rows = (data ?? [])
      .filter((v) => !q || v.sku.includes(q))
      .map((v) => ({ id: v.variant_id, productId: v.product_id, product: v.product_name, sku: v.sku, variant: "", onHand: v.stock_on_hand, reserved: v.stock_reserved, threshold: v.low_stock_threshold, active: true }));
    total = rows.length;
  } else {
    const { from, to } = pageRange(page, PAGE_SIZE);
    let query = supabase
      .from("product_variants")
      .select("id, sku, stock_on_hand, stock_reserved, low_stock_threshold, is_active, product_id, sizes ( code ), colors ( name ), products ( slug, product_translations ( locale, name ) )", { count: "exact" })
      .order("sku")
      .range(from, to);
    if (q) query = query.ilike("sku", `%${q}%`);
    const { data, count } = await query;
    total = count ?? 0;
    rows = (data ?? []).map((v) => ({
      id: v.id,
      productId: v.product_id,
      product: v.products?.product_translations.find((t) => t.locale === "tr")?.name ?? v.products?.slug ?? "—",
      sku: v.sku,
      variant: [v.sizes?.code, v.colors ? pickLocale(v.colors.name, "tr") : null].filter(Boolean).join(" / "),
      onHand: v.stock_on_hand,
      reserved: v.stock_reserved,
      threshold: v.low_stock_threshold,
      active: v.is_active,
    }));
  }

  return (
    <div>
      <PageHeader
        title="Stok yönetimi"
        description="Kullanılabilir = eldeki − ödeme bekleyen siparişler için rezerve edilen."
        actions={
          <Link href="/admin/inventory/movements" className="inline-flex h-9 items-center rounded-sm border border-line px-3 text-xs uppercase tracking-wide hover:bg-sand-100">
            Stok hareketleri
          </Link>
        }
      />
      <FilterBar action="/admin/inventory">
        <FilterField label="SKU ara" className="flex-1">
          <Input name="q" defaultValue={q} />
        </FilterField>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={low} className="h-4 w-4 accent-[var(--color-olive)]" /> Yalnızca az stoklular
        </label>
      </FilterBar>

      <TableWrap label="Varyant stokları">
        <thead>
          <tr>
            <Th>Ürün</Th>
            <Th>SKU</Th>
            <Th>Varyant</Th>
            <Th className="text-right">Eldeki</Th>
            <Th className="text-right">Rezerve</Th>
            <Th className="text-right">Kullanılabilir</Th>
            <Th className="text-right">Eşik</Th>
            <Th>Güncelle</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={8}>{low ? "Az stoklu varyant yok." : "Varyant bulunamadı."}</EmptyRow> : null}
          {rows.map((r) => {
            const available = r.onHand - r.reserved;
            return (
              <tr key={r.id} className={r.active ? undefined : "opacity-60"}>
                <Td>
                  <Link href={`/admin/products/${r.productId}#variants`} className="underline-offset-4 hover:underline">
                    {r.product}
                  </Link>
                  {!r.active ? <span className="ml-1 text-xs text-muted">(pasif)</span> : null}
                </Td>
                <Td className="font-mono text-xs">{r.sku}</Td>
                <Td className="text-xs">{r.variant || "—"}</Td>
                <Td className="text-right tabular-nums">{r.onHand}</Td>
                <Td className="text-right tabular-nums">{r.reserved}</Td>
                <Td className={`text-right font-semibold tabular-nums ${available <= r.threshold ? "text-burgundy" : ""}`}>{available}</Td>
                <Td className="text-right tabular-nums text-muted">{r.threshold}</Td>
                <Td>
                  <StockCell variantId={r.id} onHand={r.onHand} reserved={r.reserved} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {!low ? <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} basePath="/admin/inventory" params={{ q }} /> : <p className="mt-3 text-xs text-muted">{total} kayıt</p>}

      <Card title="Toplu stok güncelleme (CSV)" className="mt-8 max-w-3xl">
        <StockImport />
      </Card>
    </div>
  );
}
