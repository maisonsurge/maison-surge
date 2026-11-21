import { requireStaff } from "@/server/auth";
import { saveHomepageSection } from "@/server/admin/content";
import { PageHeader } from "@/features/admin/ui/primitives";
import { SectionForm } from "@/features/admin/content/section-form";
import { loadSectionOptions } from "@/features/admin/content/load";

export const metadata = { title: "Yeni blok" };

export default async function NewSectionPage() {
  await requireStaff("content.manage");
  const options = await loadSectionOptions();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Yeni ana sayfa bloğu" description="Yeni blok listenin sonuna eklenir." back={{ href: "/admin/homepage", label: "Ana sayfa" }} />
      <SectionForm action={saveHomepageSection.bind(null, null)} values={null} {...options} />
    </div>
  );
}
