import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteProduct, duplicateProduct, saveProduct } from "@/server/admin/products";
import { isUuid } from "@/server/admin/common";
import { Alert } from "@/components/ui/feedback";
import { Card, PageHeader, PublishBadge, sp, type SearchParams } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { ProductForm } from "@/features/admin/products/product-form";
import { VariantsEditor } from "@/features/admin/products/variants-editor";
import { ImageManager } from "@/features/admin/products/image-manager";
import { loadCatalogOptions } from "@/features/admin/products/load-options";

export const metadata = { title: "Ürün düzenle" };

type Alt = { tr?: string; en?: string };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireStaff("catalog.manage");
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, options] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, slug, status, category_id, is_featured, is_demo, base_price, compare_at_price, size_guide,
         product_translations ( locale, name, description, material, care, seo_title, seo_description ),
         product_costs ( cost_price ),
         product_variants ( id, sku, size_id, color_id, price, compare_at_price, stock_on_hand, stock_reserved, low_stock_threshold, is_active, position ),
         product_images ( id, path, alt, color_id, is_cover, position, width, height ),
         collection_products ( collection_id )`,
      )
      .eq("id", id)
      .maybeSingle(),
    loadCatalogOptions(),
  ]);
  if (!p) notFound();

  const tr = p.product_translations.find((t) => t.locale === "tr") ?? null;
  const en = p.product_translations.find((t) => t.locale === "en") ?? null;
  const cost = Array.isArray(p.product_costs) ? (p.product_costs[0]?.cost_price ?? null) : (p.product_costs?.cost_price ?? null);
  const variants = [...p.product_variants].sort((a, b) => a.position - b.position || a.sku.localeCompare(b.sku));
  const images = [...p.product_images].sort((a, b) => a.position - b.position).map((i) => ({ ...i, alt: (i.alt ?? {}) as Alt }));
  const activeVariants = variants.filter((v) => v.is_active).length;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={tr?.name ?? p.slug}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <PublishBadge status={p.status} /> /{p.slug}
          </span>
        }
        back={{ href: "/admin/products", label: "Ürünler" }}
        actions={
          <>
            {p.status === "published" ? (
              <Link href={`/tr/product/${p.slug}`} target="_blank" className="inline-flex h-9 items-center gap-1 rounded-sm border border-line px-3 text-xs uppercase tracking-wide hover:bg-sand-100">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Mağazada gör
              </Link>
            ) : null}
            <ActionButton action={duplicateProduct.bind(null, p.id)} variant="outline">
              <Copy className="h-3.5 w-3.5" aria-hidden /> Kopyala
            </ActionButton>
            <ActionButton
              action={deleteProduct.bind(null, p.id)}
              variant="danger"
              confirm={{
                title: "Ürün kalıcı olarak silinsin mi?",
                body: "Varyantlar, görseller ve çeviriler silinir. Geçmiş siparişlerdeki satırlar korunur. Satıştan kaldırmak için “Arşiv” durumu önerilir.",
                confirmLabel: "Kalıcı olarak sil",
              }}
            >
              Sil
            </ActionButton>
          </>
        }
      />

      {sp(query, "created") ? (
        <Alert tone="success" className="mb-6">
          Ürün oluşturuldu. Şimdi varyant (beden/renk/stok) ve görsel ekleyin.
        </Alert>
      ) : null}
      {p.is_demo ? (
        <Alert tone="warning" className="mb-6">
          Bu bir demo üründür. Canlıya çıkmadan önce gerçek ürünlerle değiştirin veya Ayarlar → Demo verilerini sil.
        </Alert>
      ) : null}
      {p.status === "published" && activeVariants === 0 ? (
        <Alert tone="danger" className="mb-6">
          Yayındaki ürünün aktif varyantı yok; mağazada listelenmez ve satın alınamaz.
        </Alert>
      ) : null}

      <ProductForm
        action={saveProduct.bind(null, p.id)}
        isNew={false}
        categories={options.categories}
        collections={options.collections}
        values={{
          slug: p.slug,
          category_id: p.category_id,
          status: p.status,
          is_featured: p.is_featured,
          base_price: p.base_price,
          compare_at_price: p.compare_at_price,
          cost_price: cost,
          size_guide: (p.size_guide ?? {}) as Alt,
          tr,
          en,
          collection_ids: p.collection_products.map((c) => c.collection_id),
        }}
      />

      <div id="variants" className="mt-8 scroll-mt-20">
        <Card title={`Varyantlar ve stok (${variants.length})`}>
          <VariantsEditor productId={p.id} basePrice={p.base_price} variants={variants} sizes={options.sizes} colors={options.colors} />
        </Card>
      </div>

      <div id="images" className="mt-8 scroll-mt-20">
        <Card title={`Görseller (${images.length})`}>
          <ImageManager productId={p.id} images={images} colors={options.colors.map(({ id, label }) => ({ id, label }))} />
        </Card>
      </div>
    </div>
  );
}
