import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { requireStaff } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { deleteHomepageSection, moveHomepageSection, toggleHomepageSection } from "@/server/admin/content";
import { pickLocale } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { ActiveBadge, EmptyRow, PageHeader, TableWrap, Td, Th } from "@/features/admin/ui/primitives";
import { ActionButton } from "@/features/admin/ui/action-button";
import { SECTION_LABELS, type SectionType } from "@/features/admin/content/section-types";

export const metadata = { title: "Ana sayfa" };

export default async function HomepageAdminPage() {
  await requireStaff("content.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("homepage_sections").select("id, type, title, is_active, position").order("position").order("created_at");
  const list = data ?? [];
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Ana sayfa blokları"
        description="Blokların sırası mağaza ana sayfasındaki sıradır. Duyuru çubuğu Ayarlar sayfasından yönetilir."
        actions={
          <>
            <Link href="/tr" target="_blank" className="inline-flex h-11 items-center rounded-sm border border-line px-4 text-xs uppercase tracking-wide hover:bg-sand-100">
              Önizle
            </Link>
            <ButtonLink href="/admin/homepage/new">
              <Plus className="h-4 w-4" aria-hidden /> Yeni blok
            </ButtonLink>
          </>
        }
      />
      <TableWrap label="Ana sayfa blokları">
        <thead>
          <tr>
            <Th className="w-12">#</Th>
            <Th>Blok</Th>
            <Th>Tür</Th>
            <Th>Durum</Th>
            <Th className="text-right">İşlemler</Th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? <EmptyRow colSpan={5}>Ana sayfada blok yok.</EmptyRow> : null}
          {list.map((s, i) => (
            <tr key={s.id}>
              <Td className="tabular-nums text-muted">{i + 1}</Td>
              <Td>
                <Link href={`/admin/homepage/${s.id}`} className="font-medium underline-offset-4 hover:underline">
                  {pickLocale(s.title, "tr") || "(başlıksız)"}
                </Link>
              </Td>
              <Td className="text-xs">{SECTION_LABELS[s.type as SectionType] ?? s.type}</Td>
              <Td>
                <ActiveBadge active={s.is_active} />
              </Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1">
                  <ActionButton action={moveHomepageSection.bind(null, s.id, -1)} variant="ghost" size="icon" ariaLabel="Yukarı taşı" disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </ActionButton>
                  <ActionButton action={moveHomepageSection.bind(null, s.id, 1)} variant="ghost" size="icon" ariaLabel="Aşağı taşı" disabled={i === list.length - 1}>
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </ActionButton>
                  <ActionButton action={toggleHomepageSection.bind(null, s.id, !s.is_active)} variant="ghost">
                    {s.is_active ? "Gizle" : "Göster"}
                  </ActionButton>
                  <ActionButton action={deleteHomepageSection.bind(null, s.id)} variant="ghost" confirm={{ title: "Blok silinsin mi?", confirmLabel: "Sil" }}>
                    Sil
                  </ActionButton>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
