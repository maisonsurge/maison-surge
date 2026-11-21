import { requireStaff } from "@/server/auth";
import { saveCollection } from "@/server/admin/catalog";
import { PageHeader } from "@/features/admin/ui/primitives";
import { TaxonomyForm } from "@/features/admin/catalog/taxonomy-form";

export const metadata = { title: "Yeni koleksiyon" };

export default async function NewCollectionPage() {
  await requireStaff("catalog.manage");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Yeni koleksiyon" description="Oluşturduktan sonra ürün ekleyebilirsiniz." back={{ href: "/admin/collections", label: "Koleksiyonlar" }} />
      <TaxonomyForm kind="collection" action={saveCollection.bind(null, null)} values={null} />
    </div>
  );
}
