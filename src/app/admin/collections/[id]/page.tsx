import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { addProductToCollection, deleteCollection, moveCollectionProduct, removeProductFromCollection, saveCollection } from "@/server/admin/catalog";
import { isUuid } from "@/server/admin/common";
import { pickLocale } from "@/lib/utils";
import { Card, EmptyRow, PageHeader, PublishBadge, TableWrap, Td, Th } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { ActionForm, FormSubmit, SelectField } from "@/features/admin/ui/action-form";
import { TaxonomyForm } from "@/features/admin/catalog/taxonomy-form";

export const metadata = { title: "Koleksiyon düzenle" };
type L = { tr?: string; en?: string };

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("catalog.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: c }, { data: members }, { data: products }] = await Promise.all([
    supabase.from("collections").select("*").eq("id", id).maybeSingle(),
    supabase.from("collection_products").select("product_id, position, products ( id, slug, status, product_translations ( locale, name ) )").eq("collection_id", id).order("position").order("product_id"),
    supabase.from("products").select("id, slug, product_translations ( locale, name )").neq("status", "archived").order("updated_at", { ascending: false }).limit(500),
  ]);
  if (!c) notFound();
  const memberIds = new Set((members ?? []).map((m) => m.product_id));
  const nameOf = (p: { slug: string; product_translations: { locale: string; name: string }[] }) => p.product_translations.find((t) => t.locale === "tr")?.name ?? p.slug;
  const list = members ?? [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={pickLocale(c.name, "tr")}
        description={`/${c.slug}`}
        back={{ href: "/admin/collections", label: "Koleksiyonlar" }}
        actions={
          <ActionButton action={deleteCollection.bind(null, c.id)} variant="danger" confirm={{ title: "Koleksiyon silinsin mi?", body: "Ürünler silinmez, yalnızca koleksiyon ilişkisi kaldırılır.", confirmLabel: "Sil" }}>
            Sil
          </ActionButton>
        }
      />
      <TaxonomyForm
        kind="collection"
        action={saveCollection.bind(null, c.id)}
        values={{ slug: c.slug, name: c.name as L, description: c.description as L, image_path: c.image_path, position: c.position, is_active: c.is_active }}
      />

      <Card title={`Ürünler (${list.length})`} className="mt-8">
        <ActionForm action={addProductToCollection.bind(null, c.id)} className="mb-4 flex flex-wrap items-end gap-3" successMessage="Ürün eklendi.">
          <SelectField
            name="product_id"
            label="Ürün ekle"
            className="min-w-[16rem] flex-1"
            placeholder="— Ürün seçin —"
            options={(products ?? []).filter((p) => !memberIds.has(p.id)).map((p) => ({ value: p.id, label: nameOf(p) }))}
          />
          <FormSubmit size="md" variant="secondary">
            Ekle
          </FormSubmit>
        </ActionForm>
        <TableWrap label="Koleksiyon ürünleri">
          <thead>
            <tr>
              <Th className="w-12">#</Th>
              <Th>Ürün</Th>
              <Th>Durum</Th>
              <Th className="text-right">İşlem</Th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? <EmptyRow colSpan={4}>Bu koleksiyonda ürün yok.</EmptyRow> : null}
            {list.map((m, i) =>
              m.products ? (
                <tr key={m.product_id}>
                  <Td className="tabular-nums text-muted">{i + 1}</Td>
                  <Td>
                    <Link href={`/admin/products/${m.product_id}`} className="underline-offset-4 hover:underline">
                      {nameOf(m.products)}
                    </Link>
                  </Td>
                  <Td>
                    <PublishBadge status={m.products.status} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ActionButton action={moveCollectionProduct.bind(null, c.id, m.product_id, -1)} variant="ghost" size="icon" ariaLabel="Yukarı taşı" disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={moveCollectionProduct.bind(null, c.id, m.product_id, 1)} variant="ghost" size="icon" ariaLabel="Aşağı taşı" disabled={i === list.length - 1}>
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={removeProductFromCollection.bind(null, c.id, m.product_id)} variant="ghost" successMessage="Çıkarıldı.">
                        Çıkar
                      </ActionButton>
                    </div>
                  </Td>
                </tr>
              ) : null,
            )}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
