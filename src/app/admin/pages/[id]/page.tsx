import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteContentPage, saveContentPage } from "@/server/admin/content";
import { isUuid } from "@/server/admin/common";
import { pickLocale } from "@/lib/utils";
import { Alert } from "@/components/ui/feedback";
import { PageHeader, sp, type SearchParams } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { PageForm } from "@/features/admin/content/page-form";

export const metadata = { title: "Sayfa düzenle" };
type L = { tr?: string; en?: string };

export default async function EditContentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireStaff("content.manage");
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("content_pages").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={pickLocale(p.title, "tr")}
        back={{ href: "/admin/pages", label: "Sayfalar" }}
        actions={
          <>
            {p.is_published ? (
              <Link href={`/tr/pages/${p.slug}`} target="_blank" className="inline-flex h-9 items-center rounded-sm border border-line px-3 text-xs uppercase tracking-wide hover:bg-sand-100">
                Mağazada gör
              </Link>
            ) : null}
            <ActionButton action={deleteContentPage.bind(null, p.id)} variant="danger" confirm={{ title: "Sayfa silinsin mi?", body: "Footer ve ödeme adımındaki bağlantılar bu sayfaya işaret ediyorsa kırılır.", confirmLabel: "Sil" }}>
              Sil
            </ActionButton>
          </>
        }
      />
      {sp(query, "created") ? (
        <Alert tone="success" className="mb-6">
          Sayfa oluşturuldu.
        </Alert>
      ) : null}
      {p.needs_legal_review ? (
        <Alert tone="warning" className="mb-6">
          Bu metin hukuki/işletme onayı bekliyor. [YER TUTUCU] alanlarını gerçek bilgilerle değiştirin ve onaydan sonra işareti kaldırın.
        </Alert>
      ) : null}
      <PageForm
        action={saveContentPage.bind(null, p.id)}
        values={{ slug: p.slug, title: p.title as L, body: p.body as L, is_published: p.is_published, needs_legal_review: p.needs_legal_review, position: p.position }}
      />
    </div>
  );
}
