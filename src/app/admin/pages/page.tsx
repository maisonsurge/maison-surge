import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { formatDate, pickLocale } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { EmptyRow, PageHeader, TableWrap, Td, Th } from "@/features/admin/ui/primitives";

export const metadata = { title: "Sayfalar" };

export default async function ContentPagesPage() {
  await requireStaff("content.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("content_pages").select("id, slug, title, is_published, needs_legal_review, updated_at, body").order("position");
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Bilgi ve yasal sayfalar"
        description="Yasal metinler hukukçu/işletme onayından geçmeden “Hukuki onay bekliyor” işareti kaldırılmamalıdır."
        actions={
          <ButtonLink href="/admin/pages/new">
            <Plus className="h-4 w-4" aria-hidden /> Yeni sayfa
          </ButtonLink>
        }
      />
      <TableWrap label="Sayfalar">
        <thead>
          <tr>
            <Th>Başlık</Th>
            <Th>Adres</Th>
            <Th>Durum</Th>
            <Th>EN</Th>
            <Th>Güncelleme</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).length === 0 ? <EmptyRow colSpan={5}>Sayfa yok.</EmptyRow> : null}
          {(data ?? []).map((p) => {
            const hasEn = Boolean(pickLocale(p.body, "en") && (p.body as { en?: string }).en);
            return (
              <tr key={p.id}>
                <Td>
                  <Link href={`/admin/pages/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                    {pickLocale(p.title, "tr")}
                  </Link>
                </Td>
                <Td className="text-xs text-muted">/pages/{p.slug}</Td>
                <Td className="space-x-1">
                  {p.is_published ? <Badge tone="success">Yayında</Badge> : <Badge>Gizli</Badge>}
                  {p.needs_legal_review ? <Badge tone="warning">Hukuki onay bekliyor</Badge> : null}
                </Td>
                <Td className="text-xs">{hasEn ? "Var" : "—"}</Td>
                <Td className="text-xs text-muted">{formatDate(p.updated_at, "tr", true)}</Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </div>
  );
}
