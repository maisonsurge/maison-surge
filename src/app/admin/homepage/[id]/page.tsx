import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteHomepageSection, saveHomepageSection } from "@/server/admin/content";
import { isUuid } from "@/server/admin/common";
import { pickLocale } from "@/lib/utils";
import { Alert } from "@/components/ui/feedback";
import { PageHeader, sp, type SearchParams } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { SectionForm } from "@/features/admin/content/section-form";
import { loadSectionOptions, toSectionValues } from "@/features/admin/content/load";

export const metadata = { title: "Blok düzenle" };

export default async function EditSectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireStaff("content.manage");
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: s }, options] = await Promise.all([supabase.from("homepage_sections").select("*").eq("id", id).maybeSingle(), loadSectionOptions()]);
  if (!s) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={pickLocale(s.title, "tr") || "Blok"}
        back={{ href: "/admin/homepage", label: "Ana sayfa" }}
        actions={
          <ActionButton action={deleteHomepageSection.bind(null, s.id)} variant="danger" confirm={{ title: "Blok silinsin mi?", confirmLabel: "Sil" }}>
            Sil
          </ActionButton>
        }
      />
      {sp(query, "created") ? (
        <Alert tone="success" className="mb-6">
          Blok oluşturuldu.
        </Alert>
      ) : null}
      <SectionForm action={saveHomepageSection.bind(null, s.id)} values={toSectionValues(s)} {...options} />
    </div>
  );
}
