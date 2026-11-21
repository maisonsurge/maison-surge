import { requireStaff } from "@/server/auth";
import { saveProduct } from "@/server/admin/products";
import { PageHeader } from "@/features/admin/ui/primitives";
import { ProductForm } from "@/features/admin/products/product-form";
import { loadCatalogOptions } from "@/features/admin/products/load-options";

export const metadata = { title: "Yeni ürün" };

export default async function NewProductPage() {
  await requireStaff("catalog.manage");
  const options = await loadCatalogOptions();
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Yeni ürün"
        description="Ürün önce kaydedilir; ardından varyant, stok ve görsel ekleyebilirsiniz. Yayına almadan önce en az bir aktif varyant ekleyin."
        back={{ href: "/admin/products", label: "Ürünler" }}
      />
      <ProductForm action={saveProduct.bind(null, null)} values={null} categories={options.categories} collections={options.collections} isNew />
    </div>
  );
}
