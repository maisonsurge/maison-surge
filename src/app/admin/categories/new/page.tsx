import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { saveCategory } from "@/server/admin/catalog";
import { pickLocale } from "@/lib/utils";
import { PageHeader } from "@/features/admin/ui/primitives";
import { TaxonomyForm } from "@/features/admin/catalog/taxonomy-form";

export const metadata = { title: "Yeni kategori" };

export default async function NewCategoryPage() {
  await requireStaff("catalog.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("position");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Yeni kategori" back={{ href: "/admin/categories", label: "Kategoriler" }} />
      <TaxonomyForm kind="category" action={saveCategory.bind(null, null)} values={null} parents={(data ?? []).map((c) => ({ id: c.id, label: pickLocale(c.name, "tr") }))} />
    </div>
  );
}
