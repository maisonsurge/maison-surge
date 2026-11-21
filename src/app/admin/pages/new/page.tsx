import { requireStaff } from "@/server/auth";
import { saveContentPage } from "@/server/admin/content";
import { PageHeader } from "@/features/admin/ui/primitives";
import { PageForm } from "@/features/admin/content/page-form";

export const metadata = { title: "Yeni sayfa" };

export default async function NewContentPage() {
  await requireStaff("content.manage");
  return (
    <div className="max-w-5xl">
      <PageHeader title="Yeni sayfa" back={{ href: "/admin/pages", label: "Sayfalar" }} />
      <PageForm action={saveContentPage.bind(null, null)} values={null} />
    </div>
  );
}
