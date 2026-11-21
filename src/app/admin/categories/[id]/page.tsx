import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteCategory, saveCategory } from "@/server/admin/catalog";
import { isUuid } from "@/server/admin/common";
import { pickLocale } from "@/lib/utils";
import { PageHeader } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { TaxonomyForm } from "@/features/admin/catalog/taxonomy-form";

export const metadata = { title: "Kategori düzenle" };
type L = { tr?: string; en?: string };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("catalog.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: c }, { data: all }] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name, parent_id").order("position"),
  ]);
  if (!c) notFound();
  // Exclude self and descendants from parent options.
  const excluded = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of all ?? []) if (x.parent_id && excluded.has(x.parent_id) && !excluded.has(x.id)) {
      excluded.add(x.id);
      grew = true;
    }
  }
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={pickLocale(c.name, "tr")}
        description={`/${c.slug}`}
        back={{ href: "/admin/categories", label: "Kategoriler" }}
        actions={
          <ActionButton
            action={deleteCategory.bind(null, c.id)}
            variant="danger"
            confirm={{ title: "Kategori silinsin mi?", body: "Bu kategorideki ürünler kategorisiz kalır; alt kategoriler ana kategoriye dönüşür.", confirmLabel: "Sil" }}
          >
            Sil
          </ActionButton>
        }
      />
      <TaxonomyForm
        kind="category"
        action={saveCategory.bind(null, c.id)}
        parents={(all ?? []).filter((x) => !excluded.has(x.id)).map((x) => ({ id: x.id, label: pickLocale(x.name, "tr") }))}
        values={{
          slug: c.slug,
          parent_id: c.parent_id,
          name: c.name as L,
          description: c.description as L,
          seo_title: c.seo_title as L,
          seo_description: c.seo_description as L,
          image_path: c.image_path,
          position: c.position,
          is_active: c.is_active,
        }}
      />
    </div>
  );
}
